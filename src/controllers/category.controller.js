const mongoose = require('mongoose');
const Category = require('../models/category.model');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

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
// Cotizador y Admin ven solo las activas; Admin puede pedir todas con ?all=true
async function getCategories(req, res) {
  try {
    const filter =
      req.query.all === 'true' && req.user?.role === 'ADMIN'
        ? {}
        : { isActive: true };

    const categories = await Category.find(filter).sort({ name: 1 });
    return ok(res, categories.map(mapCategory));
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

    await category.save();
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
