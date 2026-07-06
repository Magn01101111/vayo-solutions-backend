const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Quote = require('../models/quote.model');
const Product = require('../models/product.model');
const { ROLES } = require('../constants/roles');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapSale(sale) {
  const author = sale.createdBy && typeof sale.createdBy === 'object' ? sale.createdBy : null;
  return {
    id: sale._id,
    folio: sale.folio,
    quoteId: sale.quoteId,
    quoteFolio: sale.quoteFolio,
    clientId: sale.clientId,
    client: sale.client,
    items: sale.items ?? [],
    coupon: sale.coupon ?? null,
    manualDiscount: sale.manualDiscount ?? null,
    billingAddress: sale.billingAddress ?? {},
    shippingAddress: sale.shippingAddress ?? {},
    shippingSameAsBilling: sale.shippingSameAsBilling ?? true,
    shipping: sale.shipping ?? {},
    paymentTerms: sale.paymentTerms ?? 'contado',
    deliveryTerms: sale.deliveryTerms ?? 'pickup',
    totals: sale.totals ?? {},
    currency: sale.currency,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    notes: sale.notes,
    createdBy: author ? { id: author._id, name: author.name } : (sale.createdBy ?? null),
    createdByName: author?.name ?? null,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

// ── GET /api/sales ─────────────────────────────────────────────────────────────
// Query: ?folio=  ?status=  ?clientId=
async function getSales(req, res) {
  try {
    const filter = {};
    if (req.query.folio) filter.folio = req.query.folio.toUpperCase().trim();
    if (req.query.status) filter.status = req.query.status;
    if (req.query.clientId && mongoose.Types.ObjectId.isValid(req.query.clientId)) {
      filter.clientId = req.query.clientId;
    }

    const sales = await Sale.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    const mapped = sales.map(mapSale);

    // CLIENTE solo ve sus ventas
    if (req.user?.role === ROLES.CLIENTE) {
      if (!req.user.clientId) return ok(res, []);
      return ok(res, mapped.filter((s) => String(s.clientId) === String(req.user.clientId)));
    }

    return ok(res, mapped);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/sales/:id ─────────────────────────────────────────────────────────
async function getSaleById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de venta inválido');
    }
    const sale = await Sale.findById(req.params.id).populate('createdBy', 'name');
    if (!sale) return notFound(res, 'Venta no encontrada');

    // CLIENTE solo ve sus propias ventas
    if (
      req.user?.role === ROLES.CLIENTE &&
      (!sale.clientId || String(sale.clientId) !== String(req.user.clientId))
    ) {
      return notFound(res, 'Venta no encontrada');
    }

    return ok(res, mapSale(sale));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/sales/from-quote/:quoteId ───────────────────────────────────────
// Convierte una cotización en venta. Toma un snapshot de la cotización.
async function createSaleFromQuote(req, res) {
  try {
    const { quoteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quoteId)) {
      return fail(res, 'ID de cotización inválido');
    }

    const quote = await Quote.findById(quoteId);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    // No permitir convertir dos veces la misma cotización
    const existing = await Sale.findOne({ quoteId });
    if (existing) {
      return conflict(res, `Esta cotización ya fue convertida en la venta ${existing.folio}`);
    }

    const { paymentMethod, notes } = req.body || {};

    const sale = await Sale.create({
      quoteId: quote._id,
      quoteFolio: quote.folio,
      clientId: quote.clientId ?? null,
      client: {
        name: quote.client?.name ?? '',
        email: quote.client?.email ?? '',
        phone: quote.client?.phone ?? '',
        company: quote.client?.company ?? '',
        taxId: quote.client?.taxId ?? '',
      },
      items: (quote.items ?? []).map((it) => ({
        productId: it.productId,
        name: it.name,
        sku: it.sku ?? '',
        price: it.price ?? 0,
        listPrice: it.listPrice ?? null,
        offerPrice: it.offerPrice ?? null,
        offerApplied: !!it.offerApplied,
        offerDiscountPercent: it.offerDiscountPercent ?? 0,
        quantity: it.quantity ?? 1,
        total: it.total ?? 0,
      })),
      // Heredar el snapshot del cupón aplicado en la cotización (si lo hubo).
      coupon: quote.coupon?.code
        ? {
            code: quote.coupon.code,
            type: quote.coupon.type ?? '',
            value: quote.coupon.value ?? 0,
            description: quote.coupon.description ?? '',
        }
        : { code: '', type: '', value: 0, description: '' },
      manualDiscount: {
        percent: quote.manualDiscount?.percent ?? 0,
        amount: quote.manualDiscount?.amount ?? 0,
        reason: quote.manualDiscount?.reason ?? '',
        appliedBy: quote.manualDiscount?.appliedBy ?? null,
        appliedAt: quote.manualDiscount?.appliedAt ?? null,
      },
      billingAddress: quote.billingAddress ?? {},
      shippingAddress: quote.shippingAddress ?? {},
      shippingSameAsBilling: quote.shippingSameAsBilling ?? true,
      shipping: {
        methodId: quote.shipping?.methodId ?? 'pickup',
        methodLabel: quote.shipping?.methodLabel ?? 'Retiro en tienda',
        estimatedDays: quote.shipping?.estimatedDays ?? '',
        cost: quote.shipping?.cost ?? quote.totals?.shipping ?? 0,
      },
      paymentTerms: quote.paymentTerms ?? 'contado',
      deliveryTerms: quote.deliveryTerms ?? 'pickup',
      totals: {
        subtotal: quote.totals?.subtotal ?? 0,
        discount: quote.totals?.discount ?? 0,
        iva: quote.totals?.iva ?? 0,
        shipping: quote.totals?.shipping ?? 0,
        total: quote.totals?.total ?? 0,
      },
      currency: quote.currency ?? 'CLP',
      paymentMethod: paymentMethod || 'transfer',
      status: 'pending',
      createdBy: req.user?.id ?? null,
      notes: notes || '',
    });

    // Descontar stock de los productos vendidos
    for (const item of sale.items) {
      if (item.productId && item.quantity > 0) {
        await Product.updateOne(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
        );
      }
    }

    // Marcar la cotización como aceptada (quedó cerrada en venta)
    quote.metadata = quote.metadata || {};
    quote.metadata.status = 'accepted';
    await quote.save();

    return created(res, mapSale(sale));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/sales/:id/status ───────────────────────────────────────────────
// Body: { status: 'pending' | 'paid' | 'cancelled' }
async function updateSaleStatus(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de venta inválido');
    }
    const { status } = req.body || {};
    const allowed = ['pending', 'paid', 'cancelled'];
    if (!allowed.includes(status)) {
      return fail(res, `Estado inválido. Use: ${allowed.join(', ')}`);
    }

    const sale = await Sale.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!sale) return notFound(res, 'Venta no encontrada');

    return ok(res, mapSale(sale));
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getSales,
  getSaleById,
  createSaleFromQuote,
  updateSaleStatus,
};
