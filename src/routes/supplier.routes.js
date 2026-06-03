const express = require('express');
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
} = require('../controllers/supplier.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Lectura pública (la ficha de producto muestra proveedores).
router.get('/', optionalAuth, getSuppliers);
router.get('/:id', optionalAuth, getSupplierById);

// Escritura: solo ADMIN.
router.post('/', verifyToken, requireRole(ROLES.ADMIN), createSupplier);
router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), updateSupplier);
router.patch('/:id/deactivate', verifyToken, requireRole(ROLES.ADMIN), deactivateSupplier);

module.exports = router;
