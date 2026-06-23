const Sale = require('../models/sale.model');
const Quote = require('../models/quote.model');
const Client = require('../models/client.model');
const { ok, fail, serverError } = require('../utils/response');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Construye un filtro de rango de fechas sobre `createdAt`.
 * Acepta ?from=YYYY-MM-DD y ?to=YYYY-MM-DD (ambos opcionales).
 */
function dateRangeFilter(query) {
  const filter = {};
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      // incluir todo el día "to"
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }
  return filter;
}

/** Escapa un valor para CSV (comillas, comas, saltos de línea). */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convierte filas (array de objetos) a string CSV con BOM para Excel. */
function toCSV(headers, rows) {
  const headerLine = headers.map((h) => csvCell(h.label)).join(';');
  const dataLines = rows.map((row) =>
    headers.map((h) => csvCell(h.value(row))).join(';')
  );
  // BOM (﻿) para que Excel reconozca UTF-8 y muestre tildes bien.
  return '﻿' + [headerLine, ...dataLines].join('\r\n');
}

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  return res.send(csv);
}

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date) ? '' : date.toLocaleDateString('es-CL');
};

/** Etiqueta legible del origen de una cotización. */
const sourceLabel = (s) =>
  ({ client: 'Cliente (portal)', guest: 'Invitado', assisted: 'Venta asistida' }[s] || 'Invitado');

/** Nombre del cotizador a partir de createdBy poblado. */
const authorName = (doc) =>
  doc.createdBy && typeof doc.createdBy === 'object' ? doc.createdBy.name || '' : '';

// ── GET /api/reports/sales[.csv] ──────────────────────────────────────────────
// Query: ?from= ?to= ?status= ?format=csv|json (default json)
async function reportSales(req, res) {
  try {
    const filter = dateRangeFilter(req.query);
    if (req.query.status) filter.status = req.query.status;

    const sales = await Sale.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.format === 'csv') {
      const headers = [
        { label: 'Folio',        value: (s) => s.folio },
        { label: 'Fecha',        value: (s) => fmtDate(s.createdAt) },
        { label: 'Cliente',      value: (s) => s.client?.name || s.client?.company || '' },
        { label: 'RUT',          value: (s) => s.client?.taxId || '' },
        { label: 'Cotización',   value: (s) => s.quoteFolio || '' },
        { label: 'Registrada por', value: (s) => authorName(s) },
        { label: 'Método pago',  value: (s) => s.paymentMethod || '' },
        { label: 'Estado',       value: (s) => s.status || '' },
        { label: 'Subtotal',     value: (s) => s.totals?.subtotal ?? 0 },
        { label: 'IVA',          value: (s) => s.totals?.iva ?? 0 },
        { label: 'Total',        value: (s) => s.totals?.total ?? 0 },
      ];
      return sendCSV(res, 'reporte-ventas.csv', toCSV(headers, sales));
    }

    // JSON con resumen agregado
    const valid = sales.filter((s) => s.status !== 'cancelled');
    return ok(res, {
      count: sales.length,
      totalRevenue: valid.reduce((a, s) => a + (s.totals?.total ?? 0), 0),
      rows: sales,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/reports/quotes[.csv] ─────────────────────────────────────────────
async function reportQuotes(req, res) {
  try {
    const filter = dateRangeFilter(req.query);
    if (req.query.status) filter['metadata.status'] = req.query.status;

    const quotes = await Quote.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.format === 'csv') {
      const headers = [
        { label: 'Folio',      value: (q) => q.folio },
        { label: 'Fecha',      value: (q) => fmtDate(q.createdAt) },
        { label: 'Cliente',    value: (q) => q.client?.name || q.client?.company || '' },
        { label: 'RUT',        value: (q) => q.client?.taxId || '' },
        { label: 'Email',      value: (q) => q.client?.email || '' },
        { label: 'Origen',     value: (q) => sourceLabel(q.source) },
        { label: 'Atendido por', value: (q) => authorName(q) },
        { label: 'Ítems',      value: (q) => (q.items || []).length },
        { label: 'Estado',     value: (q) => q.metadata?.status || '' },
        { label: 'Subtotal',   value: (q) => q.totals?.subtotal ?? 0 },
        { label: 'IVA',        value: (q) => q.totals?.iva ?? 0 },
        { label: 'Total',      value: (q) => q.totals?.total ?? 0 },
      ];
      return sendCSV(res, 'reporte-cotizaciones.csv', toCSV(headers, quotes));
    }

    return ok(res, { count: quotes.length, rows: quotes });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/reports/clients[.csv] ────────────────────────────────────────────
async function reportClients(req, res) {
  try {
    const filter = dateRangeFilter(req.query);

    const clients = await Client.find(filter).sort({ createdAt: -1 }).lean();

    if (req.query.format === 'csv') {
      const headers = [
        { label: 'Nombre',   value: (c) => c.name },
        { label: 'Empresa',  value: (c) => c.company || '' },
        { label: 'RUT',      value: (c) => c.rut || '' },
        { label: 'Email',    value: (c) => c.email || '' },
        { label: 'Teléfono', value: (c) => c.phone || '' },
        { label: 'Dirección',value: (c) => c.address || '' },
        { label: 'Estado',   value: (c) => (c.isActive ? 'Activo' : 'Inactivo') },
        { label: 'Registrado', value: (c) => fmtDate(c.createdAt) },
      ];
      return sendCSV(res, 'reporte-clientes.csv', toCSV(headers, clients));
    }

    return ok(res, { count: clients.length, rows: clients });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/reports/products-most-quoted ───────────────────────────────────────
async function reportMostQuotedProducts(req, res) {
  try {
    const dateFilter = dateRangeFilter(req.query);

    const pipeline = [
      { $match: dateFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          totalQuoted: { $sum: '$items.quantity' },
          totalAmount: { $sum: '$items.total' },
          quoteCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuoted: -1 } },
      { $limit: 50 },
    ];

    const rows = await Quote.aggregate(pipeline);

    return ok(res, { count: rows.length, rows });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { reportSales, reportQuotes, reportClients, reportMostQuotedProducts };
