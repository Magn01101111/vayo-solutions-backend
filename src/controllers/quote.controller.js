const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Quote = require('../models/quote.model');
const Sale = require('../models/sale.model');
const Client = require('../models/client.model');
const Coupon = require('../models/coupon.model');
const Product = require('../models/product.model');
const Company = require('../models/company.model');
const Notification = require('../models/notification.model');
const { evaluateCoupon, consumeCoupon } = require('./coupon.controller');
const { generateQuotePDF } = require('../services/pdf.service');
const {
  sendQuoteEmail,
  sendQuoteViewedNotification,
  sendQuoteStatusNotification,
} = require('../services/email.service');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const { validateRut, normalizeChileanPhone } = require('../utils/validators');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

/**
 * Asegura que exista un Client CRM para una cotización de invitado.
 *
 * Busca por RUT canónico: si existe lo reutiliza, si no lo crea (sin cuenta de
 * portal). Así los invitados quedan registrados en el CRM y no se duplican
 * cuando el mismo RUT vuelve a cotizar. Devuelve el _id del Client o null.
 *
 * Es tolerante a fallos: si algo sale mal, no rompe la cotización (devuelve null).
 */
async function ensureGuestClient(clientSnapshot, addresses) {
  try {
    const canonicalRut = validateRut(clientSnapshot.taxId);
    if (!canonicalRut) return null; // sin RUT válido no podemos deduplicar

    // ¿Ya existe un cliente con ese RUT?
    let client = await Client.findOne({ rut: canonicalRut });
    if (client) return client._id;

    // Crear nuevo Client (invitado, sin cuenta de portal)
    const billing = addresses.billingAddress || {};
    const addressLine = [billing.street, billing.number, billing.city, billing.region]
      .filter(Boolean)
      .join(' ');

    client = await Client.create({
      name: clientSnapshot.name || 'Cliente',
      company: clientSnapshot.company || undefined,
      rut: canonicalRut,
      email: clientSnapshot.email || undefined,
      phone: normalizeChileanPhone(clientSnapshot.phone) || undefined,
      address: addressLine || undefined,
      notes: 'Registrado vía compra como invitado',
      createdBy: null, // se auto-registró desde el portal público
    });
    return client._id;
  } catch (err) {
    console.warn('[ensureGuestClient] no se pudo crear/vincular cliente:', err.message);
    return null;
  }
}

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

  // ── Origen + asociaciones (dinámica cliente/cotizador) ──────────────────────
  if (req?.user?.role === ROLES.CLIENTE) {
    // Cliente con cuenta: la cotización es suya.
    if (req.user.clientId) doc.clientId = req.user.clientId;
    doc.source = 'client';
  } else if (req?.user) {
    // Interno (COTIZADOR/ADMIN): venta asistida, queda registrado como autor.
    doc.createdBy = req.user.id;
    doc.source = 'assisted';
    // Asignación explícita a un cliente existente (buscado por RUT/nombre en el
    // builder asistido). Si no viene, más abajo se deduplica por RUT.
    const assignId = extra.assignClientId || body.assignClientId;
    if (assignId && mongoose.Types.ObjectId.isValid(assignId)) {
      doc.clientId = assignId;
    }
  } else {
    // Visitante sin sesión.
    doc.source = 'guest';
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

/**
 * Normaliza una cotización (lean, con createdBy poblado) para la respuesta:
 * expone el cotizador como objeto {id,name} + un `createdByName` plano y
 * mantiene `source`. Así el panel puede mostrar la unión cliente/cotizador.
 */
function mapQuote(q) {
  const author = q.createdBy && typeof q.createdBy === 'object' ? q.createdBy : null;
  return {
    ...q,
    createdBy: author ? { id: author._id, name: author.name, email: author.email } : (q.createdBy ?? null),
    createdByName: author?.name ?? null,
    source: q.source ?? (q.createdBy ? 'assisted' : (q.clientId ? 'client' : 'guest')),
  };
}

function safeMoney(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function clampMoney(value, min, max) {
  return Math.min(Math.max(safeMoney(value), min), max);
}

function deliveryTermForShipping(methodId) {
  if (methodId === 'pickup') return 'pickup';
  if (methodId === 'national') return 'shipping';
  return 'delivery';
}

function recalculateQuoteTotals(quote, discountAmount) {
  const subtotal = (quote.items ?? []).reduce((sum, item) => {
    const lineTotal = Number(item.total);
    if (Number.isFinite(lineTotal)) return sum + lineTotal;
    return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
  }, 0);
  const discount = clampMoney(discountAmount, 0, subtotal);
  const taxableBase = Math.max(0, subtotal - discount);
  const ivaPercent = quote.totals?.ivaPercent ?? 19;
  const iva = Math.round(taxableBase * (ivaPercent / 100));
  const shipping = safeMoney(quote.shipping?.cost ?? quote.totals?.shipping ?? 0);

  quote.totals = {
    ...(quote.totals?.toObject ? quote.totals.toObject() : quote.totals),
    subtotal,
    discount,
    taxableBase,
    iva,
    ivaPercent,
    shipping,
    total: taxableBase + iva + shipping,
  };
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
    if (req.query.source && ['client', 'guest', 'assisted'].includes(req.query.source)) {
      filter.source = req.query.source;
    }

    if (req.user?.role === ROLES.CLIENTE) {
      if (!req.user.clientId) return ok(res, []);
      filter.clientId = req.user.clientId;
    }

    // Filtros para roles internos (venta asistida)
    if (req.user?.role !== ROLES.CLIENTE) {
      if (req.query.mine === 'true') {
        filter.createdBy = req.user.id;
      } else if (
        req.query.createdBy &&
        mongoose.Types.ObjectId.isValid(req.query.createdBy)
      ) {
        filter.createdBy = req.query.createdBy;
      }
    }

    const quotes = await Quote.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, quotes.map(mapQuote));
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

    const quote = await Quote.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();
    if (!quote) return notFound(res, 'Cotización no encontrada');

    if (req.user?.role === ROLES.CLIENTE) {
      if (
        !quote.clientId ||
        String(quote.clientId) !== String(req.user.clientId)
      ) {
        return notFound(res, 'Cotización no encontrada');
      }
    }

    return ok(res, mapQuote(quote));
  } catch (error) {
    return serverError(res, error);
  }
};

// ── PATCH /api/quotes/:id/status ──────────────────────────────────────────────
// ADMIN/COTIZADOR: cualquier estado. CLIENTE dueño: solo accepted/rejected en sus cotizaciones.
const updateQuoteStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }
    const { status } = req.body || {};
    const allowed = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    const isInternal = req.user?.role === ROLES.ADMIN || req.user?.role === ROLES.COTIZADOR;
    const isClientOwner =
      req.user?.role === ROLES.CLIENTE &&
      quote.clientId &&
      String(quote.clientId) === String(req.user.clientId);

    if (isInternal) {
      if (!allowed.includes(status)) {
        return fail(res, `Estado inválido. Use: ${allowed.join(', ')}`);
      }
    } else if (isClientOwner) {
      if (!['accepted', 'rejected'].includes(status)) {
        return fail(res, 'Solo puedes aceptar o rechazar esta cotización');
      }
    } else {
      return fail(res, 'No tienes permiso para modificar esta cotización', 403);
    }

    quote.metadata = quote.metadata || {};
    quote.metadata.status = status;
    await quote.save();

    // Notificar al cotizador/admin cuando el CLIENTE acepta o rechaza
    if (isClientOwner && (status === 'accepted' || status === 'rejected')) {
      resolveNotificationEmail(quote).then((to) => {
        if (to) {
          sendQuoteStatusNotification({
            to,
            folio: quote.folio,
            status,
            clientName: quote.client?.name,
          }).catch(() => {});
        }
      });
    }

    return ok(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
};

/**
 * Resuelve el email al que enviar notificaciones internas de una cotización.
 * Prioridad: autor (createdBy) > email de la empresa > null.
 */
// ADMIN/COTIZADOR: aplica descuento manual y/o corrige terminos comerciales.
// Webpay se mantiene como pago inmediato; paymentTerms queda como condicion
// comercial de la cotizacion y no como cuotas/deuda dentro de Transbank.
const updateQuoteCommercialTerms = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotizacion invalido');
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotizacion no encontrada');

    const existingSale = await Sale.findOne({ quoteId: quote._id }).select('_id folio').lean();
    if (existingSale) {
      return fail(
        res,
        `La cotizacion ya fue convertida en la venta ${existingSale.folio}. Ajusta la venta o crea una nueva cotizacion.`,
        409
      );
    }

    const body = req.body || {};
    const currentDiscount = quote.manualDiscount?.amount ?? quote.totals?.discount ?? 0;
    const requestedDiscount = body.discount ?? body.manualDiscount?.amount ?? currentDiscount;
    const subtotalForClamp = (quote.items ?? []).reduce((sum, item) => {
      const lineTotal = Number(item.total);
      if (Number.isFinite(lineTotal)) return sum + lineTotal;
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
    const discount = clampMoney(requestedDiscount, 0, subtotalForClamp);
    const reason = String(body.reason ?? body.manualDiscount?.reason ?? quote.manualDiscount?.reason ?? '')
      .trim()
      .slice(0, 300);

    if (body.shipping) {
      const methodId = String(body.shipping.methodId ?? body.shipping.method?.id ?? quote.shipping?.methodId ?? 'pickup');
      const methodLabel = String(body.shipping.methodLabel ?? body.shipping.method?.label ?? quote.shipping?.methodLabel ?? 'Retiro en tienda');
      const estimatedDays = String(body.shipping.estimatedDays ?? body.shipping.method?.estimatedDays ?? quote.shipping?.estimatedDays ?? '');
      const cost = safeMoney(body.shipping.cost ?? body.shipping.method?.cost ?? quote.shipping?.cost ?? 0);

      quote.shipping = { methodId, methodLabel, estimatedDays, cost };
    }

    const allowedPaymentTerms = ['contado', '15-dias', '30-dias', '60-dias', '90-dias'];
    if (body.paymentTerms != null) {
      if (!allowedPaymentTerms.includes(body.paymentTerms)) {
        return fail(res, `Forma de pago invalida. Use: ${allowedPaymentTerms.join(', ')}`);
      }
      quote.paymentTerms = body.paymentTerms;
    }

    const allowedDeliveryTerms = ['pickup', 'delivery', 'shipping'];
    if (body.deliveryTerms != null) {
      if (!allowedDeliveryTerms.includes(body.deliveryTerms)) {
        return fail(res, `Tipo de entrega invalido. Use: ${allowedDeliveryTerms.join(', ')}`);
      }
      quote.deliveryTerms = body.deliveryTerms;
    } else if (body.shipping) {
      quote.deliveryTerms = deliveryTermForShipping(quote.shipping?.methodId);
    }

    quote.manualDiscount = {
      amount: discount,
      reason: discount > 0 ? reason : '',
      appliedBy: discount > 0 ? (req.user?.id ?? null) : null,
      appliedAt: discount > 0 ? new Date() : null,
    };

    recalculateQuoteTotals(quote, discount);
    await quote.save();
    await quote.populate('createdBy', 'name email');

    return ok(res, mapQuote(quote.toObject()));
  } catch (error) {
    return serverError(res, error);
  }
};

// Email interno para notificaciones: autor (createdBy) > empresa > null.
async function resolveNotificationEmail(quote) {
  try {
    if (quote.createdBy) {
      const author = await User.findById(quote.createdBy).select('email').lean();
      if (author?.email) return author.email;
    }
    const company = await Company.findOne().select('email').lean();
    return company?.email || null;
  } catch {
    return null;
  }
}

// ── PATCH /api/quotes/:id/mark-viewed ─────────────────────────────────────────
// El CLIENTE marca su cotización como vista (primera apertura).
// Envía notificación al cotizador/admin solo la primera vez.
const markQuoteViewed = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    // Solo el CLIENTE dueño marca la cotización como vista. El resto de roles
    // (interno) no debe disparar la notificación "el cliente la revisó".
    const isClientOwner =
      req.user?.role === ROLES.CLIENTE &&
      quote.clientId &&
      String(quote.clientId) === String(req.user.clientId);

    if (req.user?.role === ROLES.CLIENTE && !isClientOwner) {
      return notFound(res, 'Cotización no encontrada');
    }

    if (isClientOwner && !quote.viewedAt) {
      quote.viewedAt = new Date();
      await quote.save();

      // Notificar al cotizador/admin (no bloquea la respuesta si falla)
      resolveNotificationEmail(quote).then((to) => {
        if (to) {
          sendQuoteViewedNotification({
            to,
            folio: quote.folio,
            clientName: quote.client?.name,
          }).catch(() => {});
        }
      });
    }

    return ok(res, { viewedAt: quote.viewedAt });
  } catch (error) {
    return serverError(res, error);
  }
};

// ── POST /api/quotes ──────────────────────────────────────────────────────────
const createQuote = async (req, res) => {
  try {
    const doc = buildQuoteDoc(req.body, req);

    if (!doc.items || doc.items.length === 0) {
      return fail(res, 'La cotización debe tener al menos un ítem');
    }

    // ── Obtener productos reales y configuración de la empresa ──
    const productIds = doc.items
      .map((it) => it.productId)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    const [products, company] = await Promise.all([
      productIds.length > 0
        ? Product.find({ _id: { $in: productIds } }).lean()
        : [],
      Company.findOne().lean(),
    ]);

    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    const ivaRate = (company?.ivaPercent ?? 19) / 100;

    // ── Recalcular cada ítem con precios reales del servidor ──
    let subtotal = 0;
    const validItems = [];

    for (const it of doc.items) {
      const product = it.productId ? productMap[String(it.productId)] : null;

      if (!product) {
        return fail(
          res,
          `Producto con ID ${it.productId} no encontrado`,
          422
        );
      }
      if (!product.isActive) {
        return fail(
          res,
          `El producto "${product.name}" no está disponible`,
          422
        );
      }

      const now = new Date();
      const isOnOffer =
        product.offerPrice != null &&
        product.offerPrice > 0 &&
        product.offerPrice < (product.price ?? Infinity) &&
        (!product.offerStartsAt || product.offerStartsAt <= now) &&
        (!product.offerEndsAt || product.offerEndsAt >= now);

      const realPrice = isOnOffer ? product.offerPrice : product.price;

      if (realPrice == null) {
        return fail(
          res,
          `El producto "${product.name}" no tiene precio asignado`,
          422
        );
      }

      const quantity = Math.max(1, Number(it.quantity) || 1);
      const itemTotal = realPrice * quantity;
      subtotal += itemTotal;

      validItems.push({
        productId: product._id,
        name: product.name,
        sku: product.sku || '',
        price: realPrice,
        quantity,
        total: itemTotal,
        notes: it.notes || '',
      });
    }

    doc.items = validItems;
    doc.totals.subtotal = subtotal;
    doc.totals.ivaPercent = company?.ivaPercent ?? 19;

    // ── Validar y aplicar cupón sobre el subtotal real ──
    let appliedCoupon = null;
    if (doc.coupon && doc.coupon.code) {
      const coupon = await Coupon.findOne({
        code: doc.coupon.code.toUpperCase().trim(),
      });
      // Pasar el userId: los cupones personales (ownerUserId) solo aplican a su
      // titular. Para invitados (sin sesión) va null → solo cupones públicos.
      const result = evaluateCoupon(coupon, subtotal, req.user?.id ?? null);
      if (result.valid) {
        appliedCoupon = coupon;
        const discount = result.discount;
        doc.coupon = {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          description: coupon.description || '',
        };
        doc.totals.discount = discount;
        doc.totals.taxableBase = Math.max(0, subtotal - discount);
        doc.totals.iva = Math.round(doc.totals.taxableBase * ivaRate);
        doc.totals.total =
          doc.totals.taxableBase +
          doc.totals.iva +
          (doc.totals.shipping || 0);
      } else {
        doc.coupon = { code: '', type: '', value: 0, description: '' };
        doc.totals.discount = 0;
        doc.totals.taxableBase = subtotal;
        doc.totals.iva = Math.round(subtotal * ivaRate);
        doc.totals.total =
          subtotal + doc.totals.iva + (doc.totals.shipping || 0);
      }
    } else {
      doc.totals.discount = 0;
      doc.totals.taxableBase = subtotal;
      doc.totals.iva = Math.round(subtotal * ivaRate);
      doc.totals.total =
        subtotal + doc.totals.iva + (doc.totals.shipping || 0);
    }

    // Si la cotización NO está asociada a un cliente (compra como invitado),
    // creamos/vinculamos un Client CRM por RUT para que quede registrado.
    if (!doc.clientId) {
      const guestClientId = await ensureGuestClient(doc.client, {
        billingAddress: doc.billingAddress,
      });
      if (guestClientId) doc.clientId = guestClientId;
    }

    const quote = await Quote.create(doc);

    // F2-3: Emitir notificación admin al crear cotización
    Notification.create({
      type: 'new_quote',
      recipientRole: 'admin',
      title: 'Nueva cotización',
      body: `${doc.client?.name ?? 'Cliente'} · ${quote.folio}`,
      link: `/admin/quotes`,
    }).catch(() => {});

    if (appliedCoupon) {
      // Consumir el cupón una sola vez al CREAR la cotización (no en el PDF):
      // +1 a usedCount y, si es de uso único, marcar redeemedAt/redeemedBy.
      // No es fatal: si el guardado falla, la cotización ya quedó creada.
      consumeCoupon(appliedCoupon, req.user?.id ?? null);
      try {
        await appliedCoupon.save();
      } catch (err) {
        console.error('No se pudo consumir el cupón', appliedCoupon.code, err.message);
      }
    }

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

    const quote = await Quote.findById(req.params.id).populate('createdBy', 'name');
    if (!quote) return notFound(res, 'Cotización no encontrada');

    if (!isPdfRequestAuthorized(req, req.params.id, quote)) {
      return res
        .status(401)
        .json({ ok: false, error: 'Token de acceso no proporcionado o inválido' });
    }

    const company = await Company.findOne().lean().catch(() => ({}));
    const pdfBuffer = await generateQuotePDF(quote, company || {});

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

    const quote = await Quote.findById(req.params.id).populate('createdBy', 'name');
    if (!quote) return notFound(res, 'Cotización no encontrada');

    const to = (req.body?.to || quote.client?.email || '').trim();
    if (!to) {
      return fail(res, 'No hay email de destino. La cotización no tiene email de cliente.');
    }

    const company = await Company.findOne().lean().catch(() => ({}));
    const pdfBuffer = await generateQuotePDF(quote, company || {});

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

// ── POST /api/quotes/:id/duplicate ────────────────────────────────────────────
async function duplicateQuote(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cotización inválido');
    }

    const original = await Quote.findById(req.params.id);
    if (!original) return notFound(res, 'Cotización no encontrada');

    const doc = original.toObject();
    delete doc._id;
    delete doc.folio;
    delete doc.createdAt;
    delete doc.updatedAt;
    delete doc.__v;

    doc.metadata = { status: 'draft', createdAt: new Date().toISOString() };
    doc.createdBy = req.user?.id ?? null;

    const quote = await Quote.create(doc);
    return created(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  updateQuoteStatus,
  updateQuoteCommercialTerms,
  markQuoteViewed,
  sendQuoteByEmail,
  downloadQuotePDF,
  duplicateQuote,
};
