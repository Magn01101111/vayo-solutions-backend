const express = require('express');
const { body } = require('express-validator');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deactivateProduct,
  uploadProductImage: uploadImageHandler,
} = require('../controllers/product.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { handleValidation } = require('../middlewares/validate.middleware');
const { uploadProductImage } = require('../middlewares/upload.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Lectura: ADMIN y COTIZADOR
router.get(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getProducts
);

router.get(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getProductById
);

// Escritura: solo ADMIN
router.post(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN),
  [
    body('name').notEmpty().withMessage('El nombre del producto es requerido'),
    body('sku').notEmpty().withMessage('El SKU es requerido'),
    body('brand').notEmpty().withMessage('La marca es requerida'),
    body('categoryId').notEmpty().withMessage('La categoría es requerida'),
    handleValidation,
  ],
  createProduct
);

router.put(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN),
  updateProduct
);

router.patch(
  '/:id/deactivate',
  verifyToken,
  requireRole(ROLES.ADMIN),
  deactivateProduct
);

// POST /api/products/:id/image  → subir imagen
router.post(
  '/:id/image',
  verifyToken,
  requireRole(ROLES.ADMIN),
  (req, res, next) => {
    uploadProductImage(req, res, (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      next();
    });
  },
  uploadImageHandler
);

module.exports = router;
