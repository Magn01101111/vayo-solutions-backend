const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId:    { type: String, required: true },
  name:         { type: String, required: true },
  sku:          { type: String, default: '' },
  price:        { type: String, default: '' },
  priceRaw:     { type: Number, default: null },
  offerPriceRaw:{ type: Number, default: null },
  imageUrl:     { type: String, default: null },
  qty:          { type: Number, required: true, min: 1 },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Cart', cartSchema);
