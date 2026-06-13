const express = require('express');
const {
  getCompany,
  getPublicCompany,
  updateCompany,
  uploadLogo,
} = require('../controllers/company.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { uploadCompanyLogo } = require('../middlewares/upload.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// GET /api/company/public → datos públicos (IVA, contacto) sin auth
router.get('/public', getPublicCompany);

// GET /api/company → cualquier usuario autenticado puede ver la config
router.get('/', verifyToken, getCompany);

// PUT /api/company → solo ADMIN
router.put('/', verifyToken, requireRole(ROLES.ADMIN), updateCompany);

// POST /api/company/logo → solo ADMIN
router.post(
  '/logo',
  verifyToken,
  requireRole(ROLES.ADMIN),
  (req, res, next) => {
    uploadCompanyLogo(req, res, (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      next();
    });
  },
  uploadLogo
);

module.exports = router;
