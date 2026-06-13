const mongoose = require('mongoose');
const Favorite = require('../models/favorite.model');
const Product = require('../models/product.model');
const { mapProductList } = require('./product.controller');
const { ok, created, fail, serverError } = require('../utils/response');

// ── GET /api/favorites ─────────────────────────────────────────────────────────
// Devuelve los productos favoritos del usuario autenticado (con info completa).
async function getFavorites(req, res) {
  try {
    const favs = await Favorite.find({ userId: req.user.id }).lean();
    const productIds = favs.map((f) => f.productId);

    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
      .populate('category', 'name slug');

    return ok(res, products.map(mapProductList));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/favorites/ids ─────────────────────────────────────────────────────
// Solo los IDs (para que el front marque rápido qué productos son favoritos).
async function getFavoriteIds(req, res) {
  try {
    const favs = await Favorite.find({ userId: req.user.id }).select('productId').lean();
    return ok(res, favs.map((f) => String(f.productId)));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/favorites/:productId ─────────────────────────────────────────────
async function addFavorite(req, res) {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 'ID de producto inválido');
    }
    // upsert: si ya existe no falla (idempotente)
    await Favorite.updateOne(
      { userId: req.user.id, productId },
      { $setOnInsert: { userId: req.user.id, productId } },
      { upsert: true }
    );
    return created(res, { message: 'Agregado a favoritos', productId });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── DELETE /api/favorites/:productId ───────────────────────────────────────────
async function removeFavorite(req, res) {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 'ID de producto inválido');
    }
    await Favorite.deleteOne({ userId: req.user.id, productId });
    return ok(res, { message: 'Quitado de favoritos', productId });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { getFavorites, getFavoriteIds, addFavorite, removeFavorite };
