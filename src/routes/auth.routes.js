const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  logout,
  getProfile,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { handleValidation } = require('../middlewares/validate.middleware');

const router = express.Router();

// POST /api/auth/register  (público — crea cuenta CLIENTE)
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('rut').notEmpty().withMessage('El RUT es requerido'),
    body('phone').notEmpty().withMessage('El teléfono es requerido'),
    handleValidation,
  ],
  register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    handleValidation,
  ],
  login
);

// POST /api/auth/logout  (requiere token)
router.post('/logout', verifyToken, logout);

// GET /api/auth/me
router.get('/me', verifyToken, getProfile);

// PUT /api/auth/me/password
router.put(
  '/me/password',
  verifyToken,
  [
    body('currentPassword').notEmpty().withMessage('La contraseña actual es requerida'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
    handleValidation,
  ],
  changePassword
);

// POST /api/auth/password-reset/request
router.post(
  '/password-reset/request',
  [
    body('email').isEmail().withMessage('Email inválido'),
    handleValidation,
  ],
  requestPasswordReset
);

// POST /api/auth/password-reset/confirm
router.post(
  '/password-reset/confirm',
  [
    body('token').notEmpty().withMessage('Token requerido'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    handleValidation,
  ],
  confirmPasswordReset
);

module.exports = router;
