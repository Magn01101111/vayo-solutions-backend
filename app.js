const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const uri = process.env.ATLAS_URL;

if (!uri) {
  console.error('Falta la variable de entorno ATLAS_URL');
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true, db: 'connected' });
  } catch (error) {
    res.status(500).json({
      ok: false,
      db: 'disconnected',
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({ mensaje: 'Backend funcionando correctamente 🚀' });
});

app.get('/test-db', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json({
      ok: true,
      message: 'Conexión a MongoDB exitosa',
      collections
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

async function startServer() {
  try {
    await client.connect();
    console.log('Conectado a MongoDB Atlas');

    db = client.db('vayo_db');

    await db.command({ ping: 1 });
    console.log('Ping a MongoDB exitoso');

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();