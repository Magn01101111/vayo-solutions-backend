const mongoose = require('mongoose');

async function healthCheck(req, res) {
  try {
    const state = mongoose.connection.readyState;

    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.json({
      ok: state === 1,
      db: states[state] || 'unknown',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

async function testDB(req, res) {
  try {
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    res.json({
      ok: true,
      message: 'Conexión a MongoDB con Mongoose exitosa',
      collections,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

function home(req, res) {
  res.json({
    mensaje: 'Backend funcionando correctamente 🚀',
  });
}

module.exports = {
  healthCheck,
  testDB,
  home,
};