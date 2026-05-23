const cron = require('node-cron');
const { runBackup } = require('./backup.service');

/**
 * Programa el backup automático de la base de datos.
 *
 * Por defecto corre todos los días a las 03:00 (hora del servidor).
 * Se puede cambiar con la variable de entorno BACKUP_CRON.
 *
 * Formato cron (5 campos):  minuto hora dia-mes mes dia-semana
 *   '0 3 * * *'   -> todos los dias a las 03:00
 *   '0 * * * *'   -> cada hora en punto
 *   cada-5-min    -> usar la expresion "[asterisco]/5 * * * *" en BACKUP_CRON
 *
 * ⚠️ Nota sobre Render free tier: el servicio se "duerme" tras 15 min sin
 * tráfico, así que el cron NO dispara de forma confiable en producción gratis.
 * Para producción real conviene: (a) Atlas M10+ con backups nativos, o
 * (b) GitHub Actions con schedule (ver docs/backup.md).
 * En local/desarrollo y durante la demo funciona perfecto.
 */
function startBackupScheduler() {
  // Permite desactivarlo con BACKUP_ENABLED=false
  if (process.env.BACKUP_ENABLED === 'false') {
    console.log('[backup] Scheduler desactivado (BACKUP_ENABLED=false)');
    return;
  }

  const schedule = process.env.BACKUP_CRON || '0 3 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[backup] Expresión cron inválida: "${schedule}". Scheduler no iniciado.`);
    return;
  }

  cron.schedule(schedule, async () => {
    console.log('[backup] Ejecutando backup programado…');
    try {
      await runBackup();
    } catch (err) {
      console.error('[backup] Error en backup programado:', err.message);
    }
  });

  console.log(`[backup] Scheduler activo — programado con cron "${schedule}"`);
}

module.exports = { startBackupScheduler };
