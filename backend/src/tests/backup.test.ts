import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { S3Client } from '@aws-sdk/client-s3';

/** Respaldo a S3: argumentos de pg_dump, retención acotada a nuestro prefijo y subida completa con un pg_dump y un S3 falsos. */
process.env.JWT_SECRET ??= 'test-secret';
process.env.BACKUP_S3_ENDPOINT = 'http://s3.test';
process.env.BACKUP_S3_BUCKET = 'bucket-test';
process.env.BACKUP_S3_ACCESS_KEY_ID = 'k';
process.env.BACKUP_S3_SECRET_ACCESS_KEY = 's';
process.env.BACKUP_RETENTION_DAYS = '30';

const DAY = 24 * 3600 * 1000;

interface Stored { body: Buffer; lastModified: Date }

function fakeS3() {
  const store = new Map<string, Stored>();
  const client = {
    async send(cmd: any) {
      const name = cmd.constructor.name;
      const input = cmd.input;
      if (name === 'PutObjectCommand') {
        const chunks: Buffer[] = [];
        for await (const chunk of input.Body) chunks.push(Buffer.from(chunk));
        store.set(input.Key, { body: Buffer.concat(chunks), lastModified: new Date() });
        return {};
      }
      if (name === 'ListObjectsV2Command') {
        return {
          Contents: [...store.entries()]
            .filter(([key]) => key.startsWith(input.Prefix ?? ''))
            .map(([Key, v]) => ({ Key, Size: v.body.length, LastModified: v.lastModified })),
        };
      }
      if (name === 'DeleteObjectCommand') {
        store.delete(input.Key);
        return {};
      }
      throw new Error(`Comando inesperado ${name}`);
    },
  };
  const seed = (key: string, ageDays: number) => store.set(key, { body: Buffer.from('x'), lastModified: new Date(Date.now() - ageDays * DAY) });
  return { client: client as unknown as S3Client, store, seed };
}

describe('respaldos a S3', () => {
  let backup: typeof import('../services/backup');
  let config: typeof import('../config').config;
  let dir: string;
  let okDump: string;
  let failingDump: string;
  let tinyDump: string;

  beforeAll(async () => {
    ({ config } = await import('../config'));
    backup = await import('../services/backup');
    dir = await mkdtemp(path.join(tmpdir(), 'fake-pgdump-'));
    const script = async (name: string, body: string) => {
      const file = path.join(dir, name);
      await writeFile(file, `#!/bin/sh\n${body}\n`);
      await chmod(file, 0o755);
      return file;
    };
    okDump = await script('ok.sh', 'head -c 8192 /dev/zero');
    tinyDump = await script('tiny.sh', 'printf pequeno');
    failingDump = await script('fail.sh', 'echo "connection refused" >&2; exit 1');
  });

  afterAll(() => rm(dir, { recursive: true, force: true }));

  beforeEach(() => {
    config.backup.pgDumpBin = okDump;
    config.backup.heartbeatUrl = '';
  });

  describe('pgDumpArgs', () => {
    it('quita ?schema= de Prisma (libpq no lo entiende) y no usa --schema (omitiría btree_gist)', () => {
      const args = backup.pgDumpArgs('postgresql://u:p@host:5432/db?schema=public&sslmode=disable');
      expect(args.some((a) => a.startsWith('--schema'))).toBe(false);
      expect(args.at(-1)).toBe('postgresql://u:p@host:5432/db?sslmode=disable');
    });

    it('excluye la cola de pg-boss y usa formato custom', () => {
      const args = backup.pgDumpArgs('postgresql://u:p@host/db');
      expect(args).toEqual(['--format=custom', '--exclude-schema=pgboss', 'postgresql://u:p@host/db']);
    });
  });

  describe('retención', () => {
    it('borra solo lo viejo de nuestro prefijo y respeta lo de otros proyectos', async () => {
      const { client, store, seed } = fakeS3();
      seed('vortex-beauty-db/reciente.dump', 1);
      seed('vortex-beauty-db/mes.dump', 20);
      seed('vortex-beauty-db/viejo1.dump', 45);
      seed('vortex-beauty-db/viejo2.dump', 90);
      seed('adetravel-db/otro-proyecto-viejo.dump', 400);
      const pruned = await backup.pruneOldBackups(client, 30);
      expect(pruned.sort()).toEqual(['vortex-beauty-db/viejo1.dump', 'vortex-beauty-db/viejo2.dump']);
      expect([...store.keys()].sort()).toEqual(['adetravel-db/otro-proyecto-viejo.dump', 'vortex-beauty-db/mes.dump', 'vortex-beauty-db/reciente.dump']);
    });

    it('nunca borra el respaldo más reciente aunque todos estén vencidos', async () => {
      const { client, store, seed } = fakeS3();
      seed('vortex-beauty-db/a.dump', 40);
      seed('vortex-beauty-db/b.dump', 60);
      await backup.pruneOldBackups(client, 30);
      expect([...store.keys()]).toEqual(['vortex-beauty-db/a.dump']);
    });
  });

  describe('runBackup', () => {
    it('sube el dump con clave fechada bajo el prefijo y aplica la retención', async () => {
      const { client, store, seed } = fakeS3();
      seed('vortex-beauty-db/viejo.dump', 100);
      seed('vortex-beauty-db/ayer.dump', 1);
      const result = await backup.runBackup(client);
      expect(result.key).toMatch(/^vortex-beauty-db\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.dump$/);
      expect(result.sizeBytes).toBe(8192);
      expect(store.get(result.key)!.body.length).toBe(8192);
      expect(result.prunedKeys).toEqual(['vortex-beauty-db/viejo.dump']);
    });

    it('si pg_dump falla, no sube nada ni borra copias existentes', async () => {
      const { client, store, seed } = fakeS3();
      seed('vortex-beauty-db/viejo.dump', 100);
      config.backup.pgDumpBin = failingDump;
      await expect(backup.runBackup(client)).rejects.toThrow(/connection refused/);
      expect([...store.keys()]).toEqual(['vortex-beauty-db/viejo.dump']);
    });

    it('rechaza un dump sospechosamente pequeño', async () => {
      const { client, store } = fakeS3();
      config.backup.pgDumpBin = tinyDump;
      await expect(backup.runBackup(client)).rejects.toThrow(/sospechosamente pequeño/);
      expect(store.size).toBe(0);
    });
  });

  describe('heartbeat', () => {
    it('avisa éxito a la URL y fallo a /fail, y nunca lanza', async () => {
      const calls: string[] = [];
      vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url);
        return new Response('ok');
      });
      config.backup.heartbeatUrl = 'https://hc.test/ping/abc';
      await backup.pingHeartbeat(true);
      await backup.pingHeartbeat(false);
      expect(calls).toEqual(['https://hc.test/ping/abc', 'https://hc.test/ping/abc/fail']);

      vi.stubGlobal('fetch', async () => {
        throw new Error('sin red');
      });
      await expect(backup.pingHeartbeat(false)).resolves.toBeUndefined();
      vi.unstubAllGlobals();
    });
  });
});
