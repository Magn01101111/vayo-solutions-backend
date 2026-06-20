const Cart = require('../models/cart.model');
const { ok, serverError } = require('../utils/response');

// GET /api/cart — devuelve el carrito guardado del usuario
async function getCart(req, res) {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).lean();
    return ok(res, { items: cart?.items ?? [] });
  } catch (error) {
    return serverError(res, error);
  }
}

// PUT /api/cart — reemplaza el carrito completo (upsert)
async function saveCart(req, res) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return ok(res, { items: [] });
    }
    const clean = items
      .filter(i => i.productId && i.name && i.qty >= 1)
      .map(i => ({
        productId:     String(i.productId),
        name:          String(i.name),
        sku:           i.sku ?? '',
        price:         i.price ?? '',
        priceRaw:      i.priceRaw ?? null,
        offerPriceRaw: i.offerPriceRaw ?? null,
        imageUrl:      i.imageUrl ?? null,
        qty:           Math.max(1, Number(i.qty)),
      }));

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { items: clean } },
      { upsert: true, new: true },
    ).lean();

    return ok(res, { items: cart.items });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { getCart, saveCart };
