import { config } from '../config';
import { downloadBackup, listBackups, pingHeartbeat, runBackup } from '../services/backup';

/**
 * Operación manual de respaldos (también dentro del contenedor:
 * `node dist/src/scripts/backupCli.js <comando>`).
 *
 *   run                 hace un respaldo ahora mismo
 *   status              lista los respaldos y avisa si el último tiene más de 26 h
 *   download [archivo]  baja el más reciente (por defecto ./ultimo.dump)
 */
async function main() {
  const [command, arg] = process.argv.slice(2);
  if (!config.backup.enabled) throw new Error('Faltan variables BACKUP_S3_ENDPOINT / BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY');

  if (command === 'run') {
    try {
      const result = await runBackup();
      console.log(`Respaldo subido: ${result.key} (${(result.sizeBytes / 1024).toFixed(0)} KB)`);
      if (result.prunedKeys.length) console.log(`Retención: borrados ${result.prunedKeys.length} antiguos`);
      await pingHeartbeat(true);
    } catch (error) {
      await pingHeartbeat(false);
      throw error;
    }
  } else if (command === 'status') {
    const backups = await listBackups();
    console.log(`${backups.length} respaldos en ${config.backup.s3.bucket}/vortex-beauty-db/ (retención ${config.backup.retentionDays} días)`);
    for (const b of backups.slice(0, 10)) console.log(`  ${b.lastModified.toISOString()}  ${(b.sizeBytes / 1024).toFixed(0).padStart(8)} KB  ${b.key}`);
    const ageH = backups[0] ? (Date.now() - backups[0].lastModified.getTime()) / 3_600_000 : Infinity;
    if (ageH > 26) {
      console.error(backups[0] ? `AVISO: el último respaldo tiene ${ageH.toFixed(1)} h` : 'AVISO: no hay ningún respaldo');
      process.exitCode = 2;
    }
  } else if (command === 'download') {
    const [latest] = await listBackups();
    if (!latest) throw new Error('No hay respaldos');
    const target = arg || 'ultimo.dump';
    await downloadBackup(latest.key, target);
    console.log(`Descargado ${latest.key} → ${target}`);
  } else {
    console.log('Uso: backupCli <run|status|download [archivo]>');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
