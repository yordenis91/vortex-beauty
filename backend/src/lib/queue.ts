import { PgBoss } from 'pg-boss';
import { config } from '../config';

/**
 * Cola de trabajos en segundo plano (pg-boss, sobre la propia Postgres).
 *
 * Modos (QUEUE_MODE): `pgboss` (por defecto), `memory` (tests: los trabajos se
 * acumulan y se procesan a mano) y `off` (no encola nada).
 *
 * pg-boss crea su propio schema (`pgboss`). Si la app se conecta con un rol
 * sin permiso para crear schemas, define QUEUE_DATABASE_URL con uno que sí lo tenga.
 */
export interface JobOptions {
  /** Cuándo debe ejecutarse (por defecto, ya). */
  startAfter?: Date;
  /** Un trabajo con la misma clave no se encola dos veces. */
  singletonKey?: string;
}

export const QUEUES = {
  confirmed: 'booking.confirmed',
  reminder: 'booking.reminder',
  cancelled: 'booking.cancelled',
  backup: 'system.backup',
  dailySummary: 'summary.daily',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface QueuedJob {
  name: QueueName;
  data: Record<string, unknown>;
  options: JobOptions;
}

// ---- modo memoria (tests) ----
const memoryJobs: QueuedJob[] = [];
export const getMemoryJobs = () => memoryJobs;
export const clearMemoryJobs = () => {
  memoryJobs.length = 0;
};

// ---- modo pg-boss ----
let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (!starting) {
    starting = (async () => {
      const instance = new PgBoss(config.queueDatabaseUrl);
      instance.on('error', (error: unknown) => console.error('[queue] error de pg-boss:', error));
      await instance.start();
      for (const name of Object.values(QUEUES)) {
        await instance.createQueue(name);
      }
      boss = instance;
      return instance;
    })().catch((error) => {
      starting = null;
      throw error;
    });
  }
  return starting;
}

export async function stopBoss() {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    starting = null;
  }
}

export async function enqueue(name: QueueName, data: Record<string, unknown>, options: JobOptions = {}): Promise<void> {
  if (config.queueMode === 'off') return;
  if (config.queueMode === 'memory') {
    if (options.singletonKey && memoryJobs.some((j) => j.options.singletonKey === options.singletonKey)) return;
    memoryJobs.push({ name, data, options });
    return;
  }
  const instance = await getBoss();
  await instance.send(name, data, {
    startAfter: options.startAfter,
    singletonKey: options.singletonKey,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    // Un recordatorio de una cita pasada no sirve de nada: se descarta.
    expireInSeconds: 15 * 60,
  });
}
