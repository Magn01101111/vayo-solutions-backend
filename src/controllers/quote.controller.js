const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Quote = require('../models/quote.model');
const { generateQuotePDF } = require('../services/pdf.service');
const { sendQuoteEmail } = require('../services/email.service');
const { ROLES } = require('../constants/roles');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Toma el payload "ancho" que envía el front (con bloque `extra`)
 * y lo normaliza al schema del Quote. Es tolerante: si no viene `extra`,
 * funciona como antes.
 */
function buildQuoteDoc(body = {}, req) {
  const extra = body.extra || {};
  const baseClient = body.client || {};

  // Mapa rápido de notas por productId
  const notesByProduct = {};
  (extra.itemNotes || []).forEach((n) => {
    if (n && n.productId) notesByProduct[n.productId] = n.note || '';
  });

  const subtotal = body.totals?.subtotal ?? 0;
  const discount = extra.discount ?? 0;
  const iva = body.totals?.iva ?? 0;
  const shipCost = extra.shipping?.cost ?? 0;
  const total = body.totals?.total ?? subtotal - discount + iva + shipCost;

  const doc = {
    client: {
      customerType: extra.customerType || 'person',
      name: baseClient.name || '',
      email: baseClient.email || '',
      phone: baseClient.phone || '',
      company: baseClient.company || '',
      taxId: extra.taxId || '',
      businessActivity: extra.businessActivity || '',
      notes: baseClient.notes || '',
    },

    billingAddress: extra.billingAddress || {},
    shippingAddress: extra.shippingAddress || {},
    shippingSameAsBilling: extra.shippingSameAsBilling ?? true,

    items: (body.items || []).map((it) => ({
      productId: it.productId,
      name: it.name,
      sku: it.sku || '',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
      total: Number(it.total) || 0,
      notes: notesByProduct[it.productId] || '',
    })),

    coupon: extra.coupon
      ? {
        code: extra.coupon.code || '',
        type: extra.coupon.type || '',
        value: Number(extra.coupon.value) || 0,
        description: extra.coupon.description || '',
      }
      : { code: '', type: '', value: 0, description: '' },

    shipping: {
      methodId: extra.shipping?.method?.id || 'pickup',
      methodLabel: extra.shipping?.method?.label || 'Retiro en tienda',
      estimatedDays: extra.shipping?.method?.estimatedDays || '',
      cost: Number(shipCost) || 0,
    },

    totals: {
      subtotal,
      discount,
      taxableBase: Math.max(0, subtotal - discount),
      iva,
      shipping: shipCost,
      total,
    },

    currency: extra.currency || 'CLP',
    paymentTerms: extra.paymentTerms || 'contado',
    deliveryTerms: extra.deliveryTerms || 'pickup',
    validityDays: Number(extra.validityDays) || 30,
    validUntil: extra.validUntil ? new Date(extra.validUntil) : null,

    generalNotes: extra.generalNotes || '',
    acceptsTerms: !!extra.acceptsTerms,
    acceptsMarketing: !!extra.acceptsMarketing,

    metadata: {
      status: body.metadata?.status || 'sent',
      createdAt: body.metadata?.createdAt || new Date().toISOString(),
    },
  };

  // Asociar al CLIENTE autenticado si corresponde
  if (req?.user?.role === ROLES.CLIENTE && req.user.clientId) {
    doc.clientId = req.user.clientId;
  }

  return doc;
}

/**
 * Verifica si la request está autorizada para descargar/leer el PDF de :id.
 * Acepta: usuario logueado (con permisos) o `?token=` JWT firmado al crear.
 */
function isPdfRequestAuthorized(req, quoteIdParam, quoteDoc) {
  // 1) Sesión válida
  if (req.user) {
    if (req.user.role === ROLES.CLIENTE) {
      return (
        quoteDoc?.clientId &&
        String(quoteDoc.clientId) === String(req.user.clientId)
      );
    }
    return true; // ADMIN / COTIZADOR / etc.
  }

  // 2) Token de PDF firmado, en query (?token=...) o header X-PDF-Token
  const token = req.query?.token || req.headers['x-pdf-token'];
  if (!token) return false;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return (
      payload?.scope === 'quote-pdf' &&
      String(payload?.quoteId) === String(quoteIdParam)
    );
  } catch {
    return false;
  }
}

// ── GET /api/quotes ───────────────────────────────────────────────────────────
const getQuotes = async (req, res) => {
  try {
    const filter = {};

    if (req.query.folio) {
      filter.folio = req.query.folio.toUpperCase().trim();
    }
    if (
      req.query.clientId &&
      mongoose.Types.ObjectId.isValid(req.query.clientId)
    ) {
      filter.clientId = req.query.clientId;
    }
    if (req.query.status) {
      filter['metadata.status'] = req.query.status;
    }

    if (req.user?.role === ROLES.CLIENTE) {
      if (!req.user.clientId) return ok(res, []);
      filter.clientId = req.user.clientId;
    }

    const quotes = await Quote.find(filter).sort({ createdAt: -1 });
    return ok(res, quotes);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── GET /api/quotes/folio/:folio ──────────────────────────────────────────────
const getQuoteByFolio = async (req, res) => {
  try {
    const folio = req.params.folio?.toUpperCase().trim();
    if (!folio) return fail(res, 'Folio requerido');

    const filter = { folio };

    if (req.user?.role === ROLES.CLIENTE) {
      if (!req.user.clientId) return notFound(res, 'Cotización no encontrada');
      filter.clientId = req.user.clientId;
    }

    const quote = await Quote.findOne(filter);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    return ok(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── GET /api/quotes/:id ───────────────────────────────────────────────────────
const getQuoteById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    if (req.user?.role === ROLES.CLIENTE) {
      if (
        !quote.clientId ||
        String(quote.clientId) !== String(req.user.clientId)
      ) {
        return notFound(res, 'Cotización no encontrada');
      }
    }

    return ok(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── PATCH /api/quotes/:id/status ──────────────────────────────────────────────
// Cambia el estado de una cotización. Solo ADMIN / COTIZADOR.
// Body: { status: 'sent' | 'accepted' | 'rejected' | 'expired' }
const updateQuoteStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }
    const { status } = req.body || {};
    const allowed = ['sent', 'accepted', 'rejected', 'expired'];
    if (!allowed.includes(status)) {
      return fail(res, `Estado inválido. Use: ${allowed.join(', ')}`);
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    quote.metadata = quote.metadata || {};
    quote.metadata.status = status;
    await quote.save();

    return ok(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── POST /api/quotes ──────────────────────────────────────────────────────────
const createQuote = async (req, res) => {
  try {
    const doc = buildQuoteDoc(req.body, req);
    const quote = await Quote.create(doc);

    // Token firmado para que el creador pueda descargar el PDF sin sesión.
    const pdfToken = jwt.sign(
      { quoteId: quote._id.toString(), scope: 'quote-pdf' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return created(res, { ...quote.toObject(), pdfToken });
  } catch (error) {
    console.error('Error creando cotización:', error);
    return serverError(res, error);
  }
};

// ── GET /api/quotes/:id/pdf ───────────────────────────────────────────────────
// Ruta debe estar montada con `optionalAuth` (no `verifyToken`) para que
// también funcione el flujo público con `?token=`.
const downloadQuotePDF = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    if (!isPdfRequestAuthorized(req, req.params.id, quote)) {
      return res
        .status(401)
        .json({ ok: false, error: 'Token de acceso no proporcionado o inválido' });
    }

    const pdfBuffer = await generateQuotePDF(quote);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${quote.folio || 'quote-' + quote._id}.pdf`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF ERROR:', error);
    return serverError(res, error);
  }
};

// ── POST /api/quotes/:id/send-email ───────────────────────────────────────────
// Genera el PDF y lo envía por correo. Body opcional: { to: 'email@dest' }.
// Si no se especifica `to`, usa el email del cliente de la cotización.
const sendQuoteByEmail = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    const to = (req.body?.to || quote.client?.email || '').trim();
    if (!to) {
      return fail(res, 'No hay email de destino. La cotización no tiene email de cliente.');
    }

    const pdfBuffer = await generateQuotePDF(quote);

    const result = await sendQuoteEmail({
      to,
      folio: quote.folio,
      clientName: quote.client?.name,
      pdfBuffer,
      total: quote.totals?.total,
    });

    if (result.simulated) {
      return ok(res, {
        message: `Email simulado a ${to} (SMTP no configurado en el servidor).`,
        simulated: true,
      });
    }
    return ok(res, { message: `Cotización enviada a ${to}.` });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  updateQuoteStatus,
  sendQuoteByEmail,
  downloadQuotePDF,
};