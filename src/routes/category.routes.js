const express = require('express');
const { body } = require('express-validator');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
} = require('../controllers/category.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { handleValidation } = require('../middlewares/validate.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// ── Lectura pública (ADMIN puede usar ?all=true para ver inactivas) ───────────
router.get('/', optionalAuth, getCategories);
router.get('/:id', optionalAuth, getCategoryById);

// ── Escritura: solo ADMIN ─────────────────────────────────────────────────────
router.post(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN),
  [
    body('name').notEmpty().withMessage('El nombre de la categoría es requerido'),
    handleValidation,
  ],
  createCategory
);

router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), updateCategory);

router.patch('/:id/deactivate', verifyToken, requireRole(ROLES.ADMIN), deactivateCategory);

module.exports = router;
