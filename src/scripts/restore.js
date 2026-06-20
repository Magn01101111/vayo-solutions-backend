/**
 * Script de restauracion de un backup.
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
 *   --drop   Borra cada coleccion ANTES de restaurar (reemplazo total).
 *            Sin este flag, los documentos se insertan SOBRE los existentes
 *            (puede fallar por _id duplicado; util solo en base vacia).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { BACKUP_ROOT } = require('../services/backup.service');

function resolveBackupFolder(arg) {
  if (!fs.existsSync(BACKUP_ROOT)) {
    throw new Error(`No existe la carpeta de backups: ${BACKUP_ROOT}`);
  }

  const folders = fs
    .readdirSync(BACKUP_ROOT)
    .filter((folder) => fs.statSync(path.join(BACKUP_ROOT, folder)).isDirectory())
    .sort();

  if (folders.length === 0) {
    throw new Error('No hay backups disponibles para restaurar.');
  }

  if (!arg || arg === 'latest') {
    return folders[folders.length - 1];
  }

  if (!folders.includes(arg)) {
    throw new Error(
      `No se encontro el backup "${arg}".\nDisponibles:\n  ${folders.join('\n  ')}`
    );
  }

  return arg;
}

function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (escribe "SI" para continuar): `, (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'SI');
    });
  });
}

function loadModels() {
  const modelsDir = path.join(__dirname, '..', 'models');
  const files = fs
    .readdirSync(modelsDir)
    .filter((file) => file.endsWith('.model.js'))
    .sort();

  files.forEach((file) => {
    require(path.join(modelsDir, file));
  });
}

function findModelByCollection(collectionName) {
  return (
    Object.values(mongoose.models).find(
      (model) => model.collection?.collectionName === collectionName
    ) ?? null
  );
}

function parseBackupFile(raw) {
  try {
    return EJSON.parse(raw);
  } catch (_error) {
    return JSON.parse(raw);
  }
}

async function restore(folderName, { drop }) {
  const dir = path.join(BACKUP_ROOT, folderName);
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== '_manifest.json');

  if (files.length === 0) {
    throw new Error(`El backup "${folderName}" no contiene colecciones.`);
  }

  const db = mongoose.connection.db;
  const summary = {};

  for (const file of files) {
    const collectionName = path.basename(file, '.json');
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const docs = parseBackupFile(raw);
    const collection = db.collection(collectionName);
    const model = findModelByCollection(collectionName);

    if (drop) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (exists) {
        await collection.drop().catch(() => {});
      }
    }

    if (Array.isArray(docs) && docs.length > 0) {
      try {
        if (model) {
          await model.insertMany(docs, { ordered: false });
        } else {
          await collection.insertMany(docs, { ordered: false });
        }
      } catch (error) {
        console.warn(`[restore] Avisos en ${collectionName}: ${error.message}`);
      }
    }

    summary[collectionName] = Array.isArray(docs) ? docs.length : 0;
  }

  return summary;
}

async function main() {
  const uri = process.env.ATLAS_URL;
  if (!uri) {
    console.error('Falta ATLAS_URL en .env');
    process.exit(1);
  }

  const arg = process.argv[2];
  const drop = process.argv.includes('--drop');

  let folderName;
  try {
    folderName = resolveBackupFolder(arg);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  console.log('\n-- Restauracion de backup --');
  console.log(`Carpeta:  backups/${folderName}`);
  console.log(
    `Modo:     ${drop ? 'WARNING --drop (REEMPLAZA todo)' : 'insertar (no borra existentes)'}`
  );

  if (drop) {
    const ok = await confirm(
      '\nWARNING Esto BORRARA las colecciones actuales y las reemplazara. Continuar?'
    );
    if (!ok) {
      console.log('Cancelado. No se modifico nada.');
      process.exit(0);
    }
  }

  try {
    loadModels();
    console.log('\n[restore] Conectando a MongoDB...');
    await mongoose.connect(uri);
    console.log('[restore] Conectado. Restaurando...');

    const summary = await restore(folderName, { drop });

    console.log('\nRestauracion completada.');
    console.table(summary);
  } catch (error) {
    console.error('Error en la restauracion:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[restore] Desconectado.');
  }
}

main();
