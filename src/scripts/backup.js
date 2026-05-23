/**
 * Script de respaldo manual.
 * Uso: npm run backup
 *
 * Se conecta a la base, ejecuta un backup completo, y se desconecta.
 * Ideal para correr a mano (o en la demo de la presentación).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runBackup } = require('../services/backup.service');

async function main() {
  const uri = process.env.ATLAS_URL;
  if (!uri) {
    console.error('✖ Falta ATLAS_URL en .env');
    process.exit(1);
  }

  try {
    console.log('[backup] Conectando a MongoDB…');
    await mongoose.connect(uri);
    console.log('[backup] Conectado. Iniciando respaldo…');

    const result = await runBackup();

    console.log('\n── Resumen del backup ──');
    console.log(`Carpeta:      backups/${result.folder}`);
    console.log(`Total docs:   ${result.totalDocs}`);
    console.table(result.collections);
  } catch (error) {
    console.error('✖ Error en el backup:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[backup] Desconectado.');
  }
}

main();
