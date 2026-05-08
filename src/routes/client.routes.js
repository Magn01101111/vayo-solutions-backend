const express = require('express');
const { body } = require('express-validator');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deactivateClient,
  inviteToPortal,
  revokePortalAccess,
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

// ── Portal del cliente ────────────────────────────────────────────────────────
// Crear cuenta de portal para un Client CRM existente
router.post(
  '/:id/invite',
  verifyToken,
  requireRole(ROLES.ADMIN),
  [
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    handleValidation,
  ],
  inviteToPortal
);

// Revocar acceso al portal (elimina solo el User; el Client CRM queda)
router.delete(
  '/:id/portal-access',
  verifyToken,
  requireRole(ROLES.ADMIN),
  revokePortalAccess
);

module.exports = router;
