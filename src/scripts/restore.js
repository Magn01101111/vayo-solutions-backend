/**
 * Script de RESTAURACIÓN de un backup.
 *
 * Uso:
 *   node src/scripts/restore.js <carpeta-backup> [--drop]
 *
 * Ejemplos:
 *   node src/scripts/restore.js 2026-05-22_01-24-42
 *   node src/scripts/restore.js 2026-05-22_01-24-42 --drop
 *   node src/scripts/restore.js latest --drop
 *
 * Flags:
 *   --drop   Borra cada colección ANTES de restaurar (reemplazo total).
 *            Sin este flag, los documentos se insertan SOBRE los existentes
 *            (puede fallar por _id duplicado — útil solo en base vacía).
 *
 * ⚠️ Operación destructiva con --drop. Pide confirmación explícita.
 *
 * Cierra el ciclo de Disaster Recovery:  backup  →  (desastre)  →  restore
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const { BACKUP_ROOT } = require('../services/backup.service');

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Resuelve la carpeta a restaurar. "latest" = la más reciente. */
function resolveBackupFolder(arg) {
  if (!fs.existsSync(BACKUP_ROOT)) {
    throw new Error(`No existe la carpeta de backups: ${BACKUP_ROOT}`);
  }

  const folders = fs
    .readdirSync(BACKUP_ROOT)
    .filter((f) => fs.statSync(path.join(BACKUP_ROOT, f)).isDirectory())
    .sort(); // orden cronológico por el formato de nombre

  if (folders.length === 0) {
    throw new Error('No hay backups disponibles para restaurar.');
  }

  if (!arg || arg === 'latest') {
    return folders[folders.length - 1]; // la más reciente
  }

  if (!folders.includes(arg)) {
    throw new Error(
      `No se encontró el backup "${arg}".\nDisponibles:\n  ${folders.join('\n  ')}`
    );
  }
  return arg;
}

/** Pregunta sí/no por consola. */
function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (escribe "SI" para continuar): `, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'SI');
    });
  });
}

// ── Restauración ────────────────────────────────────────────────────────────

async function restore(folderName, { drop }) {
  const dir = path.join(BACKUP_ROOT, folderName);

  // Leer todos los .json del backup (excepto el manifiesto)
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== '_manifest.json');

  if (files.length === 0) {
    throw new Error(`El backup "${folderName}" no contiene colecciones.`);
  }

  const db = mongoose.connection.db;
  const summary = {};

  for (const file of files) {
    const collectionName = path.basename(file, '.json');
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const docs = JSON.parse(raw);

    const col = db.collection(collectionName);

    if (drop) {
      // Borrar la colección actual antes de restaurar (reemplazo total)
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (exists) await col.drop().catch(() => {}); // ignora si no existe
    }

    if (docs.length > 0) {
      // ordered:false → si un doc falla (ej _id duplicado), sigue con el resto
      await col.insertMany(docs, { ordered: false }).catch((err) => {
        console.warn(`[restore] Avisos en ${collectionName}: ${err.message}`);
      });
    }

    summary[collectionName] = docs.length;
  }

  return summary;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.ATLAS_URL;
  if (!uri) {
    console.error('✖ Falta ATLAS_URL en .env');
    process.exit(1);
  }

  const arg = process.argv[2];
  const drop = process.argv.includes('--drop');

  let folderName;
  try {
    folderName = resolveBackupFolder(arg);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }

  console.log(`\n── Restauración de backup ──`);
  console.log(`Carpeta:  backups/${folderName}`);
  console.log(`Modo:     ${drop ? '⚠️  --drop (REEMPLAZA todo)' : 'insertar (no borra existentes)'}`);

  if (drop) {
    const ok = await confirm(
      '\n⚠️  Esto BORRARÁ las colecciones actuales y las reemplazará. ¿Continuar?'
    );
    if (!ok) {
      console.log('Cancelado. No se modificó nada.');
      process.exit(0);
    }
  }

  try {
    console.log('\n[restore] Conectando a MongoDB…');
    await mongoose.connect(uri);
    console.log('[restore] Conectado. Restaurando…');

    const summary = await restore(folderName, { drop });

    console.log('\n✔ Restauración completada.');
    console.table(summary);
  } catch (error) {
    console.error('✖ Error en la restauración:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[restore] Desconectado.');
  }
}

main();
