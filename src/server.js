require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { startBackupScheduler } = require('./services/backup.scheduler');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    // Inicia el backup automático programado (cron) una vez conectada la DB
    startBackupScheduler();

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error.message);
    process.exit(1);
  }
}

startServer();