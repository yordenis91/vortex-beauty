import { config } from './config';
import { getBoss, QUEUES, stopBoss } from './lib/queue';
import { processCancelled, processConfirmed, processReminder } from './services/notifications/notifier';

/**
 * Procesa los trabajos en segundo plano: confirmaciones, recordatorios y avisos
 * de cancelación. Corre dentro de la API (WORKER_EMBEDDED, por defecto) o como
 * proceso aparte: `node dist/src/worker.js` con WORKER_EMBEDDED=false en la API.
 */
type Outcome = 'done' | 'retry';

// Si el aviso falla de forma transitoria se lanza un error para que pg-boss reintente con espera.
const settle = (outcome: Outcome) => {
  if (outcome === 'retry') throw new Error('Fallo transitorio al enviar el aviso; se reintentará');
};

export async function startWorker() {
  if (config.queueMode !== 'pgboss') return;
  const boss = await getBoss();

  await boss.work<{ tenantId: string; appointmentId: string }>(QUEUES.confirmed, async (jobs) => {
    for (const job of jobs) settle(await processConfirmed(job.data.tenantId, job.data.appointmentId));
  });
  await boss.work<{ tenantId: string; appointmentId: string; hoursBefore: number; startsAt: number }>(QUEUES.reminder, async (jobs) => {
    for (const job of jobs) {
      const { tenantId, appointmentId, hoursBefore, startsAt } = job.data;
      settle(await processReminder(tenantId, appointmentId, hoursBefore, startsAt));
    }
  });
  await boss.work<{ tenantId: string; appointmentId: string; by: 'CUSTOMER' | 'STAFF' | 'SYSTEM' }>(QUEUES.cancelled, async (jobs) => {
    for (const job of jobs) settle(await processCancelled(job.data.tenantId, job.data.appointmentId, job.data.by));
  });
  console.log('[worker] escuchando trabajos de avisos');
}

// Ejecución como proceso independiente
if (require.main === module) {
  startWorker().catch((error) => {
    console.error('[worker] no pudo arrancar:', error);
    process.exit(1);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => void stopBoss().finally(() => process.exit(0)));
  }
}
