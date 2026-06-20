const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

/**
 * Servicio de respaldo (backup) de la base de datos.
 *
 * ¿Por qué un backup propio y no el de Atlas?
 *   Atlas incluye backups automáticos SOLO desde el tier M10+ (de pago).
 *   En el tier gratuito M0 no existen, así que implementamos uno a nivel app.
 *
 * Estrategia:
 *   - Lee TODAS las colecciones de la base conectada.
 *   - Exporta cada una a un archivo .json dentro de una carpeta con timestamp.
 *   - Rota: conserva solo las últimas N copias para no llenar el disco.
 *
 * Esto cubre el escenario de "Disaster Recovery" (DR): si la base se corrompe,
 * se borra por error, o se necesita auditar un estado anterior, se puede
 * restaurar desde el JSON.
 */

// Carpeta raíz donde se guardan los backups
const BACKUP_ROOT = path.join(process.cwd(), 'backups');

// Cuántas copias conservar (rotación). Las más viejas se borran.
const MAX_BACKUPS = Number(process.env.BACKUP_KEEP) || 7;

/**
 * Genera un nombre de carpeta seguro a partir de la fecha actual.
 * Ej: "2026-05-02_03-00-00"
 */
function timestampFolderName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
}

/**
 * Ejecuta un backup completo de la base de datos.
 * @returns {Promise<{ folder: string, collections: object, totalDocs: number }>}
 */
async function runBackup() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('No hay conexión activa a MongoDB para hacer el backup');
  }

  // 1. Crear carpeta de destino
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }
  const folderName = timestampFolderName();
  const targetDir = path.join(BACKUP_ROOT, folderName);
  fs.mkdirSync(targetDir, { recursive: true });

  // 2. Listar todas las colecciones de la base
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const summary = {};
  let totalDocs = 0;

  // 3. Exportar cada colección a su propio .json
  for (const { name } of collections) {
    // Saltar colecciones internas de sistema
    if (name.startsWith('system.')) continue;

    const docs = await db.collection(name).find({}).toArray();
    const filePath = path.join(targetDir, `${name}.json`);
    fs.writeFileSync(filePath, EJSON.stringify(docs, null, 2), 'utf-8');

    summary[name] = docs.length;
    totalDocs += docs.length;
  }

  // 4. Escribir un manifiesto con metadata del backup
  const manifest = {
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    collections: summary,
    totalDocs,
    folder: folderName,
  };
  fs.writeFileSync(
    path.join(targetDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // 5. Rotación: borrar backups viejos si hay más de MAX_BACKUPS
  rotateOldBackups();

  console.log(
    `[backup] ✔ ${totalDocs} documentos respaldados en backups/${folderName}`
  );

  return { folder: folderName, collections: summary, totalDocs };
}

/**
 * Conserva solo las últimas MAX_BACKUPS carpetas, borra las más antiguas.
 */
function rotateOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;

  const folders = fs
    .readdirSync(BACKUP_ROOT)
    .filter((f) => fs.statSync(path.join(BACKUP_ROOT, f)).isDirectory())
    .sort(); // orden lexicográfico = orden cronológico por el formato de fecha

  while (folders.length > MAX_BACKUPS) {
    const oldest = folders.shift();
    fs.rmSync(path.join(BACKUP_ROOT, oldest), { recursive: true, force: true });
    console.log(`[backup] 🗑  backup antiguo eliminado: ${oldest}`);
  }
}

module.exports = { runBackup, rotateOldBackups, BACKUP_ROOT };
