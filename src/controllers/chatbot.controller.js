const Product = require('../models/product.model');
const { ok, fail, serverError } = require('../utils/response');

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:4200')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
}

function availabilityLabel(status, stock) {
  if (status === 'in_stock') return stock > 0 ? `Disponible (${stock} unidades)` : 'Disponible';
  if (status === 'out_of_stock') return 'Sin stock';
  if (status === 'on_request') return 'Disponible bajo pedido';
  if (status === 'discontinued') return 'Descontinuado';
  return 'Consultar disponibilidad';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreProduct(product, query) {
  const normalized = query.trim().toLowerCase();
  const sku = String(product.sku || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const model = String(product.model || '').toLowerCase();
  const brand = String(product.brand || '').toLowerCase();

  if (sku === normalized) return 100;
  if (name === normalized) return 95;
  if (model === normalized) return 90;
  if (sku.startsWith(normalized)) return 85;
  if (name.includes(normalized)) return 80;
  if (model.includes(normalized)) return 75;
  if (brand.includes(normalized)) return 60;
  return 40;
}

async function searchProducts(req, res) {
  try {
    const query = String(req.query.q || '').trim();
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 5));

    if (!query) {
      return fail(res, 'Debes indicar un texto de busqueda en ?q=');
    }

    const regex = new RegExp(escapeRegex(query), 'i');
    const products = await Product.find({
      isActive: true,
      $or: [
        { sku: regex },
        { name: regex },
        { brand: regex },
        { model: regex },
      ],
    })
      .populate('category', 'name slug')
      .lean();

    const baseUrl = frontendBaseUrl();
    const mapped = products
      .map((product) => ({
        id: String(product._id),
        name: product.name,
        sku: product.sku,
        brand: product.brand,
        model: product.model || null,
        stock: product.stock ?? 0,
        availabilityStatus: product.availabilityStatus,
        availabilityLabel: availabilityLabel(product.availabilityStatus, product.stock ?? 0),
        categoryName: product.category?.name ?? null,
        categorySlug: product.category?.slug ?? null,
        productUrl: `${baseUrl}/catalogo/${product._id}`,
        quoteUrl: `${baseUrl}/cotizacion`,
        imageUrl: product.images?.[0]?.url ?? product.imageUrl ?? null,
        score: scoreProduct(product, query),
      }))
      .sort((a, b) => b.score - a.score || b.stock - a.stock || a.name.localeCompare(b.name))
      .slice(0, limit);

    return ok(res, {
      query,
      count: mapped.length,
      products: mapped,
      message: mapped.length > 0
        ? 'Productos encontrados para chatbot.'
        : 'No se encontraron productos activos para esa busqueda.',
    });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  searchProducts,
};
