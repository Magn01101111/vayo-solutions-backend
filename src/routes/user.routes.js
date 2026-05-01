const express = require('express');
const { body } = require('express-validator');
const {
  getUsers,
  getUserById,
  createCotizador,
  updateCotizador,
  deactivateCotizador,
  createProveedor,
  updateProveedor,
  deactivateProveedor,
} = require('../controllers/user.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { handleValidation } = require('../middlewares/validate.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Todas las rutas de usuarios requieren autenticación de ADMIN
router.use(verifyToken, requireRole(ROLES.ADMIN));

const passwordRules = () => [
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres'),
];

const emailRules = () => [
  body('email').isEmail().withMessage('Email inválido'),
];

const nameRules = () => [
  body('name').notEmpty().withMessage('El nombre es requerido'),
];

// GET  /api/users          → lista con ?role=XXX opcional
// GET  /api/users/:id      → detalle
router.get('/', getUsers);
router.get('/:id', getUserById);

// ── Cotizadores ───────────────────────────────────────────────────────────────
router.post(
  '/cotizadores',
  [...nameRules(), ...emailRules(), ...passwordRules(), handleValidation],
  createCotizador
);
router.put('/cotizadores/:id', updateCotizador);
router.patch('/cotizadores/:id/deactivate', deactivateCotizador);

// ── Proveedores ───────────────────────────────────────────────────────────────
router.post(
  '/proveedores',
  [...nameRules(), ...emailRules(), ...passwordRules(), handleValidation],
  createProveedor
);
router.put('/proveedores/:id', updateProveedor);
router.patch('/proveedores/:id/deactivate', deactivateProveedor);

// NOTA: la gestión de CLIENTEs (CRM + portal) vive en /api/clients/*

module.exports = router;
