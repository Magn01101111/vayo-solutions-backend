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

/**
 * Devuelve el array de imágenes — para productos viejos sin `images[]`,
 * lo construye desde el campo legacy `imageUrl` para no romper nada.
 */
function resolveImages(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map((i) => ({ url: i.url, publicId: i.publicId ?? null }));
  }
  if (product.imageUrl) {
    return [{ url: product.imageUrl, publicId: product.imagePublicId ?? null }];
  }
  return [];
}

function mapProductList(product) {
  const images = resolveImages(product);
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
    images,                                                  // nueva forma
    imageUrl: images[0]?.url ?? null,                        // legacy
    imagePublicId: images[0]?.publicId ?? null,              // legacy
    isActive: product.isActive,
    isFeatured: product.isFeatured ?? false,
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
// Query: ?category=slug  ?q=texto  ?all=true (solo ADMIN)  ?featured=true
async function getProducts(req, res) {
  try {
    const { category, q, all, featured } = req.query;
    const isAdmin = req.user?.role === 'ADMIN';

    // ADMIN puede ver productos inactivos con ?all=true
    const filter = isAdmin && all === 'true' ? {} : { isActive: true };

    // Solo destacados (para el home de ofertas)
    if (featured === 'true') {
      filter.isFeatured = true;
    }

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
      images, imageUrl, imagePublicId, isActive, isFeatured, tags, specs, dimensions,
      compatibility, documents,
    } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) return fail(res, 'La categoría no existe');

    const skuTaken = await Product.findOne({ sku: sku?.toUpperCase() });
    if (skuTaken) return conflict(res, `El SKU '${sku}' ya está en uso`);

    // Si vinieron images[], se usan. Si solo viene imageUrl/imagePublicId
    // legacy, el pre-save hook del modelo los promueve a images[0].
    const product = await Product.create({
      category: categoryId, name, sku, description, brand, model,
      price, currency, stock, availabilityStatus,
      images, imageUrl, imagePublicId,
      isActive, isFeatured, tags, specs, dimensions,
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

    // ── Detectar imágenes que ya no estarán → limpiar de Cloudinary ─────────
    // Estrategia: tomar publicIds viejos, comparar con publicIds nuevos.
    // Lo que estaba antes y ya no está → se borra (fire-and-forget).
    const oldPublicIds = (product.images ?? [])
      .map((img) => img.publicId)
      .filter(Boolean);

    let newPublicIds = oldPublicIds;
    if (Array.isArray(req.body.images)) {
      newPublicIds = req.body.images.map((i) => i.publicId).filter(Boolean);
    } else if (req.body.imagePublicId !== undefined) {
      // Modo legacy: solo se setea la imagen principal
      newPublicIds = req.body.imagePublicId ? [req.body.imagePublicId] : [];
    }

    const removedPublicIds = oldPublicIds.filter((id) => !newPublicIds.includes(id));

    const allowed = [
      'name', 'description', 'brand', 'model', 'price',
      'stock', 'availabilityStatus', 'isActive', 'isFeatured',
      'images', 'imageUrl', 'imagePublicId',
      'tags', 'specs', 'dimensions', 'compatibility', 'documents',
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

    // Limpieza de imágenes que ya no están en el producto.
    // Fire-and-forget — no bloqueamos la respuesta del usuario.
    removedPublicIds.forEach((publicId) => deleteAsset(publicId));

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
