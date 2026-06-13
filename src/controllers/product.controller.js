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
    offerPrice: product.offerPrice ?? null,
    offerStartsAt: product.offerStartsAt ?? null,
    offerEndsAt: product.offerEndsAt ?? null,
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

/**
 * Mapea los suppliers asignados. Si `supplier` viene populado, expone su info;
 * si no, solo el id. Maneja proveedores eliminados (populate devuelve null).
 */
function mapSuppliers(product) {
  return (product.suppliers ?? [])
    .filter((s) => s && s.supplier) // descarta refs rotas
    .map((s) => {
      const sup = s.supplier;
      const populated = sup && typeof sup === 'object' && sup.name;
      return {
        id: populated ? sup._id : sup,
        name: populated ? sup.name : undefined,
        location: populated ? sup.location : undefined,
        deliveryTime: s.deliveryTime || '',
        speed: s.speed || 'mid',
      };
    });
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
    suppliers: mapSuppliers(product),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// ── GET /api/products ─────────────────────────────────────────────────────────
// Query: ?category=slug  ?q=texto  ?all=true (solo ADMIN)  ?featured=true
//        ?onOffer=true  ?page=1&limit=12 (paginación)
async function getProducts(req, res) {
  try {
    const { category, q, all, featured, onOffer } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const usePagination = req.query.page != null;
    const isAdmin = req.user?.role === 'ADMIN';

    // ADMIN puede ver productos inactivos con ?all=true
    const filter = isAdmin && all === 'true' ? {} : { isActive: true };

    // Solo destacados (para el home)
    if (featured === 'true') {
      filter.isFeatured = true;
    }

    // Solo productos en oferta vigente: offerPrice definido, menor al precio normal,
    // y dentro del rango de fechas si están definidas.
    if (onOffer === 'true') {
      const now = new Date();
      filter.$expr = {
        $and: [
          { $ne: ['$offerPrice', null] },
          { $gt: ['$offerPrice', 0] },
          { $lt: ['$offerPrice', '$price'] },
          { $or: [{ $eq: ['$offerStartsAt', null] }, { $lte: ['$offerStartsAt', now] }] },
          { $or: [{ $eq: ['$offerEndsAt', null] }, { $gte: ['$offerEndsAt', now] }] },
        ],
      };
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

    if (usePagination) {
      const [products, total] = await Promise.all([
        Product.find(filter)
          .populate('category', 'name slug')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Product.countDocuments(filter),
      ]);

      return ok(res, {
        products: products.map(mapProductList),
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      });
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

    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('suppliers.supplier', 'name location');

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
      price, offerPrice, offerStartsAt, offerEndsAt, currency, stock, availabilityStatus,
      images, imageUrl, imagePublicId, isActive, isFeatured, tags, specs, dimensions,
      compatibility, documents, suppliers,
    } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) return fail(res, 'La categoría no existe');

    const skuTaken = await Product.findOne({ sku: sku?.toUpperCase() });
    if (skuTaken) return conflict(res, `El SKU '${sku}' ya está en uso`);

    // Si vinieron images[], se usan. Si solo viene imageUrl/imagePublicId
    // legacy, el pre-save hook del modelo los promueve a images[0].
    const product = await Product.create({
      category: categoryId, name, sku, description, brand, model,
      price, offerPrice, offerStartsAt, offerEndsAt, currency, stock, availabilityStatus,
      images, imageUrl, imagePublicId,
      isActive, isFeatured, tags, specs, dimensions,
      compatibility, documents, suppliers,
    });

    const populated = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('suppliers.supplier', 'name location');

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
      'name', 'description', 'brand', 'model', 'price', 'offerPrice',
      'offerStartsAt', 'offerEndsAt',
      'stock', 'availabilityStatus', 'isActive', 'isFeatured',
      'images', 'imageUrl', 'imagePublicId',
      'tags', 'specs', 'dimensions', 'compatibility', 'documents', 'suppliers',
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

    const populated = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('suppliers.supplier', 'name location');

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
  mapProductList, // reutilizado por favorite.controller
};
