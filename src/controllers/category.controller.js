const mongoose = require('mongoose');
const Category = require('../models/category.model');
const cache = require('../utils/memoryCache');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

// ── Cache config ──────────────────────────────────────────────────────────────
// TTL corto en memoria del servidor. La invalidación explícita en cada write
// mantiene los datos frescos; el TTL es solo un tope de seguridad.
const CACHE_TTL_MS    = 30 * 1000; // 30 segundos
const CACHE_KEY_ACTIVE = 'categories:active';
const CACHE_KEY_ALL    = 'categories:all';
// NO usar max-age alto: el navegador cachearía el GET y no reflejaría cambios.
// `no-cache` obliga a revalidar siempre (el cache real lo maneja el servidor).
const HTTP_CACHE_HEADER = 'no-cache';

/** Borra todas las claves de cache de categorías. Llamar tras cualquier write. */
function invalidateCategoryCache() {
  cache.invalidatePrefix('categories:');
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // elimina tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapCategory(cat) {
  return {
    id: cat._id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    isActive: cat.isActive,
    createdAt: cat.createdAt,
  };
}

// ── GET /api/categories ───────────────────────────────────────────────────────
// Cotizador y Admin ven solo las activas; Admin puede pedir todas con ?all=true.
// Cache: las categorías cambian raramente → cacheamos 5 min y mandamos
// Cache-Control para que también el navegador cachee.
async function getCategories(req, res) {
  try {
    const wantsAll = req.query.all === 'true' && req.user?.role === 'ADMIN';
    const cacheKey = wantsAll ? CACHE_KEY_ALL : CACHE_KEY_ACTIVE;

    // 1. Intentar servir desde memoria
    const cached = cache.get(cacheKey);
    if (cached) {
      res.set('Cache-Control', HTTP_CACHE_HEADER);
      res.set('X-Cache', 'HIT');
      return ok(res, cached);
    }

    // 2. Cache miss → consultar DB
    const filter = wantsAll ? {} : { isActive: true };
    const categories = await Category.find(filter).sort({ name: 1 });
    const mapped = categories.map(mapCategory);

    // 3. Guardar en cache para siguientes requests
    cache.set(cacheKey, mapped, CACHE_TTL_MS);

    res.set('Cache-Control', HTTP_CACHE_HEADER);
    res.set('X-Cache', 'MISS');
    return ok(res, mapped);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/categories/:id ───────────────────────────────────────────────────
async function getCategoryById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de categoría inválido');
    }
    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res, 'Categoría no encontrada');
    return ok(res, mapCategory(category));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/categories ──────────────────────────────────────────────────────
async function createCategory(req, res) {
  try {
    const { name, description } = req.body;
    const slug = slugify(name);

    const exists = await Category.findOne({ slug });
    if (exists) return conflict(res, 'Ya existe una categoría con ese nombre');

    const category = await Category.create({ name, slug, description });
    invalidateCategoryCache();
    return created(res, mapCategory(category));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/categories/:id ───────────────────────────────────────────────────
async function updateCategory(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de categoría inválido');
    }

    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res, 'Categoría no encontrada');

    const { name, description } = req.body;

    if (name && name !== category.name) {
      const slug = slugify(name);
      const taken = await Category.findOne({ slug, _id: { $ne: category._id } });
      if (taken) return conflict(res, 'Ya existe una categoría con ese nombre');
      category.name = name;
      category.slug = slug;
    }

    if (description !== undefined) category.description = description;
    // Permite reactivar (o desactivar) la categoría desde el update.
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    await category.save();
    invalidateCategoryCache();
    return ok(res, mapCategory(category));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/categories/:id/deactivate ─────────────────────────────────────
async function deactivateCategory(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de categoría inválido');
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!category) return notFound(res, 'Categoría no encontrada');

    invalidateCategoryCache();

    return ok(res, {
      message: 'Categoría desactivada correctamente',
      id: category._id,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
};
