const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.ATLAS_URL;

  if (!uri) {
    console.error('Falta la variable de entorno ATLAS_URL');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Conectado a MongoDB Atlas con Mongoose');
  } catch (error) {
    console.error('Error conectando con Mongoose:', error.message);
    process.exit(1);
  }
}

module.exports = {
  connectDB,
};