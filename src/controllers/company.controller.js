const path = require('path');
const Company = require('../models/company.model');
const { ok, serverError } = require('../utils/response');

function buildLogoUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/company/${filename}`;
}

// ── GET /api/company ──────────────────────────────────────────────────────────
async function getCompany(req, res) {
  try {
    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({});
    }
    return ok(res, company);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/company/public ───────────────────────────────────────────────────
// Datos públicos de la empresa (SIN auth). Necesario para el front anónimo:
// IVA en el carrito/cotización y datos de contacto en el footer. Devuelve sólo
// un whitelist seguro — NO expone `invoiceTerms` ni otros campos internos.
async function getPublicCompany(req, res) {
  try {
    let company = await Company.findOne().lean();
    if (!company) {
      company = (await Company.create({})).toObject();
    }
    return ok(res, {
      name: company.name,
      ivaPercent: company.ivaPercent ?? 19,
      logoUrl: company.logoUrl,
      address: company.address,
      phone: company.phone,
      email: company.email,
      website: company.website,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/company ──────────────────────────────────────────────────────────
async function updateCompany(req, res) {
  try {
    const allowed = [
      'name', 'rut', 'address', 'phone',
      'email', 'website', 'ivaPercent', 'invoiceTerms',
    ];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const company = await Company.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true }
    );

    return ok(res, company);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/company/logo ────────────────────────────────────────────────────
async function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo' });
    }

    const logoUrl = buildLogoUrl(req, req.file.filename);

    const company = await Company.findOneAndUpdate(
      {},
      { $set: { logoUrl } },
      { new: true, upsert: true }
    );

    return ok(res, { logoUrl: company.logoUrl });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { getCompany, getPublicCompany, updateCompany, uploadLogo };
