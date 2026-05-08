const express = require('express');
const router = express.Router();

const { uploadProductImage } = require('../middlewares/upload.middleware');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');
const { uploadBuffer } = require('../services/cloudinary.service');
const { ok, fail, serverError } = require('../utils/response');

// ── POST /api/upload/product ─────────────────────────────────────────────────
// Sube una imagen a Cloudinary y devuelve la URL + public_id.
// El cliente luego usa estos valores al crear/actualizar un Producto.
// Solo ADMIN puede subir.
router.post(
  '/product',
  verifyToken,
  requireRole(ROLES.ADMIN),
  (req, res, next) => {
    uploadProductImage(req, res, (err) => {
      if (err) return fail(res, err.message, 400);
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return fail(res, 'No se envió imagen');

      const { url, publicId } = await uploadBuffer(req.file.buffer, 'vayo/products');

      return ok(res, { url, publicId });
    } catch (error) {
      return serverError(res, error);
    }
  }
);

module.exports = router;
