const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    client: {
      name: String,
      email: String,
      phone: String,
    },

    items: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        total: Number,
      },
    ],

    totals: {
      subtotal: Number,
      iva: Number,
      total: Number,
    },

    metadata: {
      status: {
        type: String,
        enum: ['sent', 'accepted', 'rejected'],
        default: 'sent',
      },
      createdAt: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Quote', quoteSchema);