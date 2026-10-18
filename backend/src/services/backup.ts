import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, type _Object } from '@aws-sdk/client-s3';
import { config } from '../config';

/**
 * Respaldo de la base: `pg_dump --format=custom` → bucket S3 compatible (MinIO).
 *
 * - Solo toca el prefijo `vortex-beauty-db/`: el bucket puede compartirse con otros
 *   proyectos sin que la retención borre sus copias.
 * - El dump se hace con un usuario no sujeto a RLS (config.backup.databaseUrl).
 * - Se excluye el schema `pgboss` (estado de la cola): restaurarlo reviviría
 *   recordatorios ya enviados.
 * - Las imágenes viven en la base, así que el dump las incluye.
 */
export const OBJECT_PREFIX = 'vortex-beauty-db/';

export interface BackupResult {
  key: string;
  sizeBytes: number;
  prunedKeys: string[];
}

export interface BackupObject {
  key: string;
  sizeBytes: number;
  lastModified: Date;
}

export function createS3Client(): S3Client {
  const { s3 } = config.backup;
  return new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    // MinIO exige path-style ("endpoint/bucket/key").
    forcePathStyle: true,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  });
}

/**
 * Prisma admite `?schema=` en la URL; libpq (pg_dump) no lo reconoce y falla, así que se quita.
 * No se traduce a `--schema`: con `--schema` pg_dump omite las extensiones (btree_gist, que
 * necesitan las restricciones anti-solapamiento de las citas) y el respaldo no se podría restaurar.
 */
export function pgDumpArgs(databaseUrl: string): string[] {
  const url = new URL(databaseUrl);
  url.searchParams.delete('schema'); // sslmode y el resto sí los entiende libpq
  return ['--format=custom', '--exclude-schema=pgboss', url.toString()];
}

/** Ejecuta pg_dump escribiendo a `file`. La URL va como argumento (nunca por un shell) y no se registra. */
async function dumpTo(file: string): Promise<void> {
  const child = spawn(config.backup.pgDumpBin, pgDumpArgs(config.backup.databaseUrl), { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-2000);
  });
  const exit = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump terminó con código ${code}: ${stderr.trim()}`))));
  });
  await Promise.all([pipeline(child.stdout, createWriteStream(file)), exit]);
}

const isOlderThan = (date: Date | undefined, days: number) => !!date && Date.now() - date.getTime() > days * 24 * 3600 * 1000;

export async function listBackups(client: S3Client = createS3Client()): Promise<BackupObject[]> {
  const objects: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: config.backup.s3.bucket, Prefix: OBJECT_PREFIX, ContinuationToken: token }));
    objects.push(...(page.Contents ?? []));
    token = page.NextContinuationToken;
  } while (token);
  return objects
    .filter((o): o is _Object & { Key: string; LastModified: Date } => !!o.Key?.endsWith('.dump') && !!o.LastModified)
    .map((o) => ({ key: o.Key, sizeBytes: o.Size ?? 0, lastModified: o.LastModified }))
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/** Borra los respaldos más viejos que la retención, pero nunca el más reciente. */
export async function pruneOldBackups(client: S3Client = createS3Client(), retentionDays = config.backup.retentionDays): Promise<string[]> {
  const [, ...older] = await listBackups(client); // el primero es el más reciente: se conserva siempre
  const toDelete = older.filter((o) => isOlderThan(o.lastModified, retentionDays));
  for (const o of toDelete) {
    await client.send(new DeleteObjectCommand({ Bucket: config.backup.s3.bucket, Key: o.key }));
  }
  return toDelete.map((o) => o.key);
}

export async function runBackup(client: S3Client = createS3Client()): Promise<BackupResult> {
  if (!config.backup.enabled) throw new Error('Respaldos no configurados: faltan variables BACKUP_S3_*');

  const dir = await mkdtemp(path.join(tmpdir(), 'vortex-backup-'));
  const file = path.join(dir, 'db.dump');
  try {
    await dumpTo(file);
    const { size } = await stat(file);
    if (size < 1024) throw new Error(`El dump es sospechosamente pequeño (${size} bytes); no se sube`);

    const key = `${OBJECT_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
    await client.send(
      new PutObjectCommand({ Bucket: config.backup.s3.bucket, Key: key, Body: createReadStream(file), ContentLength: size, ContentType: 'application/octet-stream' })
    );
    // La retención solo corre tras subir con éxito la copia nueva.
    const prunedKeys = await pruneOldBackups(client);
    return { key, sizeBytes: size, prunedKeys };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function downloadBackup(key: string, target: string, client: S3Client = createS3Client()): Promise<void> {
  const res = await client.send(new GetObjectCommand({ Bucket: config.backup.s3.bucket, Key: key }));
  await pipeline(res.Body as Readable, createWriteStream(target));
}

/** Avisa a un monitor externo (healthchecks.io, etc.): `/fail` si el respaldo falló. Nunca lanza. */
export async function pingHeartbeat(ok: boolean): Promise<void> {
  const base = config.backup.heartbeatUrl;
  if (!base) return;
  try {
    await fetch(ok ? base : `${base.replace(/\/$/, '')}/fail`, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    console.error('[backup] no se pudo avisar al monitor:', (error as Error).message);
  }
}
