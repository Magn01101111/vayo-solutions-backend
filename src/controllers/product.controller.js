const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Category = require('../models/category.model');
const { uploadBuffer, deleteAsset } = require('../services/cloudinary.service');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapProductList(product) {
  return {
    id: product._id,
    categoryId: product.category._id,
    categoryName: product.category.name,
    name: product.name,
    sku: product.sku,
    description: product.description,
    brand: product.brand,
    model: product.model,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    availabilityStatus: product.availabilityStatus,
    imageUrl: product.imageUrl,
    imagePublicId: product.imagePublicId,
    isActive: product.isActive,
    tags: product.tags ?? [],
  };
}

function mapProductDetail(product) {
  return {
    ...mapProductList(product),
    category: {
      id: product.category._id,
      name: product.category.name,
      slug: product.category.slug,
    },
    specs: product.specs ?? [],
    dimensions: product.dimensions ?? {},
    compatibility: product.compatibility ?? [],
    documents: product.documents ?? [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// ── GET /api/products ─────────────────────────────────────────────────────────
// Query: ?category=slug  ?q=texto  ?all=true (solo ADMIN)
async function getProducts(req, res) {
  try {
    const { category, q, all } = req.query;
    const isAdmin = req.user?.role === 'ADMIN';

    // ADMIN puede ver productos inactivos con ?all=true
    const filter = isAdmin && all === 'true' ? {} : { isActive: true };

    if (category) {
      const found = await Category.findOne({ slug: category, isActive: true });
      if (!found) return ok(res, []);
      filter.category = found._id;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });

    return ok(res, products.map(mapProductList));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/products/:id ─────────────────────────────────────────────────────
async function getProductById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de producto inválido');
    }

    const product = await Product.findById(req.params.id).populate(
      'category',
      'name slug'
    );

    if (!product) return notFound(res, 'Producto no encontrado');

    return ok(res, mapProductDetail(product));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/products ────────────────────────────────────────────────────────
async function createProduct(req, res) {
  try {
    const {
      categoryId, name, sku, description, brand, model,
      price, currency, stock, availabilityStatus,
      imageUrl, imagePublicId, isActive, tags, specs, dimensions,
      compatibility, documents,
    } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) return fail(res, 'La categoría no existe');

    const skuTaken = await Product.findOne({ sku: sku?.toUpperCase() });
    if (skuTaken) return conflict(res, `El SKU '${sku}' ya está en uso`);

    const product = await Product.create({
      category: categoryId, name, sku, description, brand, model,
      price, currency, stock, availabilityStatus,
      imageUrl, imagePublicId, isActive, tags, specs, dimensions,
      compatibility, documents,
    });

    const populated = await Product.findById(product._id).populate(
      'category',
      'name slug'
    );

    return created(res, mapProductDetail(populated));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
async function updateProduct(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de producto inválido');
    }

    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, 'Producto no encontrado');

    // Si la imagen va a cambiar, recordamos el public_id viejo para borrarlo
    // de Cloudinary después de actualizar el producto.
    const oldPublicId = product.imagePublicId;
    const newPublicId = req.body.imagePublicId;
    const imageChanging =
      newPublicId !== undefined && newPublicId !== oldPublicId;

    const allowed = [
      'name', 'description', 'brand', 'model', 'price',
      'stock', 'availabilityStatus', 'imageUrl', 'imagePublicId', 'tags',
      'specs', 'dimensions', 'compatibility', 'documents',
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    // Cambio de categoría con validación
    if (req.body.categoryId) {
      const cat = await Category.findById(req.body.categoryId);
      if (!cat) return fail(res, 'La categoría no existe');
      product.category = req.body.categoryId;
    }

    await product.save();

    // Si la imagen cambió y había una vieja en Cloudinary, la borramos.
    // Esto se hace DESPUÉS del save (no en transacción) — la imagen de
    // Cloudinary es un asset externo, no parte de la integridad transaccional.
    if (imageChanging && oldPublicId) {
      deleteAsset(oldPublicId); // fire-and-forget, no bloquear la respuesta
    }

    const populated = await Product.findById(product._id).populate(
      'category',
      'name slug'
    );

    return ok(res, mapProductDetail(populated));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/products/:id/deactivate ────────────────────────────────────────
async function deactivateProduct(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de producto inválido');
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!product) return notFound(res, 'Producto no encontrado');

    return ok(res, { message: 'Producto desactivado correctamente', id: product._id });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/products/:id/image ──────────────────────────────────────────────
// Sube una imagen a Cloudinary, la vincula a un producto existente y borra
// la imagen anterior del producto (si tenía).
async function uploadProductImage(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de producto inválido');
    }
    if (!req.file) {
      return fail(res, 'No se recibió ningún archivo');
    }

    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, 'Producto no encontrado');

    // 1. Subir nueva imagen a Cloudinary
    const { url, publicId } = await uploadBuffer(req.file.buffer, 'vayo/products');

    // 2. Recordar la imagen vieja para limpiarla después
    const oldPublicId = product.imagePublicId;

    // 3. Actualizar el producto con la nueva URL y public_id
    product.imageUrl       = url;
    product.imagePublicId  = publicId;
    await product.save();

    // 4. Borrar la imagen vieja de Cloudinary (fire-and-forget)
    if (oldPublicId) deleteAsset(oldPublicId);

    return ok(res, { imageUrl: url, imagePublicId: publicId });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deactivateProduct,
  uploadProductImage,
};
