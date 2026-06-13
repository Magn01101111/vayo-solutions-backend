require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./config/db');
const { startBackupScheduler } = require('./services/backup.scheduler');

const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = ['ATLAS_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Variables de entorno requeridas no configuradas: ${missing.join(', ')}`);
  console.error('   Crea un archivo .env con estas variables o configúralas en el entorno.');
  process.exit(1);
}

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