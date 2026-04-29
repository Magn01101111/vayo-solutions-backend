const express = require('express');
const { body } = require('express-validator');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deactivateClient,
} = require('../controllers/client.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { handleValidation } = require('../middlewares/validate.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Lectura: ADMIN y COTIZADOR pueden ver clientes (para crear cotizaciones)
router.get(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getClients
);

router.get(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getClientById
);

// Escritura: solo ADMIN
router.post(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    handleValidation,
  ],
  createClient
);

router.put(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN),
  updateClient
);

router.patch(
  '/:id/deactivate',
  verifyToken,
  requireRole(ROLES.ADMIN),
  deactivateClient
);

module.exports = router;
