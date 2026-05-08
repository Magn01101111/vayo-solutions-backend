const mongoose = require('mongoose');

/**
 * Configuración de la empresa VAYO (singleton).
 * Solo existe un documento en la colección.
 * El controlador garantiza la creación o actualización del único registro.
 */
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: 'VAYO Solutions',
    },
    rut: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    ivaPercent: {
      type: Number,
      default: 19,
      min: 0,
      max: 100,
    },
    invoiceTerms: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Company', companySchema);
