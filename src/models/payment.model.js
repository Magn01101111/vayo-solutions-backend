const mongoose = require('mongoose');

/**
 * Payment — registro de cada intento de pago con Webpay Plus.
 * Una venta puede tener múltiples registros (reintentos), pero solo uno
 * puede quedar en status 'authorized'. Los anteriores se cancelan al
 * iniciar un nuevo intento.
 */
const paymentSchema = new mongoose.Schema(
  {
    /** Venta asociada. */
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },

    /** Token de sesión entregado por Transbank al crear la transacción. */
    tbkToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    /** buyOrder enviado a Transbank (máx 26 chars). */
    tbkBuyOrder: { type: String, default: '' },

    /** sessionId enviado a Transbank (máx 61 chars). */
    tbkSessionId: { type: String, default: '' },

    /** Monto en CLP (entero). */
    amount: { type: Number, required: true },

    /** Estado del intento de pago. */
    status: {
      type: String,
      enum: ['pending', 'authorized', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    /** Respuesta completa de Transbank al hacer commit (para auditoría). */
    tbkResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Código de autorización bancaria (ej. "1213"). */
    authorizationCode: { type: String, default: '' },

    /** Últimos 4 dígitos de la tarjeta. */
    cardLast4: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payment', paymentSchema);
