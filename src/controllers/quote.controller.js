const mongoose = require('mongoose');
const Quote = require('../models/quote.model');
const { generateQuotePDF } = require('../services/pdf.service');
const { ROLES } = require('../constants/roles');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

// ── GET /api/quotes ───────────────────────────────────────────────────────────
// Query: ?folio=Q-2026-0001  ?clientId=...  ?status=sent
// Permisos:
//   - ADMIN/COTIZADOR: ven todas
//   - CLIENTE: solo las suyas (filtro automático por su clientId)
const getQuotes = async (req, res) => {
  try {
    const filter = {};

    if (req.query.folio) {
      filter.folio = req.query.folio.toUpperCase().trim();
    }
    if (req.query.clientId && mongoose.Types.ObjectId.isValid(req.query.clientId)) {
      filter.clientId = req.query.clientId;
    }
    if (req.query.status) {
      filter['metadata.status'] = req.query.status;
    }

    // Si es CLIENTE, forzar filtro por su propio clientId (privacidad)
    if (req.user?.role === ROLES.CLIENTE) {
      if (!req.user.clientId) {
        return ok(res, []); // CLIENTE sin ficha CRM → no tiene cotizaciones aún
      }
      filter.clientId = req.user.clientId;
    }

    const quotes = await Quote.find(filter).sort({ createdAt: -1 });
    return ok(res, quotes);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── GET /api/quotes/folio/:folio ──────────────────────────────────────────────
// Búsqueda directa por folio (HU: cliente busca por número de folio).
const getQuoteByFolio = async (req, res) => {
  try {
    const folio = req.params.folio?.toUpperCase().trim();
    if (!folio) return fail(res, 'Folio requerido');

    const filter = { folio };

    // CLIENTE solo puede ver su propia cotización aunque sepa el folio
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

    // CLIENTE solo puede ver las suyas
    if (req.user?.role === ROLES.CLIENTE) {
      if (!quote.clientId || String(quote.clientId) !== String(req.user.clientId)) {
        return notFound(res, 'Cotización no encontrada');
      }
    }

    return ok(res, quote);
  } catch (error) {
    return serverError(res, error);
  }
};

// ── POST /api/quotes ──────────────────────────────────────────────────────────
const createQuote = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Si es un CLIENTE autenticado, asociar automáticamente su clientId
    if (req.user?.role === ROLES.CLIENTE && req.user.clientId) {
      payload.clientId = req.user.clientId;
    }

    const quote = await Quote.create(payload);
    return created(res, quote);
  } catch (error) {
    console.error('Error creando cotización:', error);
    return serverError(res, error);
  }
};

// ── GET /api/quotes/:id/pdf ───────────────────────────────────────────────────
const downloadQuotePDF = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return notFound(res, 'Cotización no encontrada');

    const pdfBuffer = await generateQuotePDF(quote);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${quote.folio || 'quote-' + quote._id}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF ERROR:', error);
    return serverError(res, error);
  }
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  downloadQuotePDF,
};
