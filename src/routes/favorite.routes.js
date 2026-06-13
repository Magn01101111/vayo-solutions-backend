const express = require('express');
const {
  getFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
} = require('../controllers/favorite.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Todas requieren sesión de CLIENTE (los favoritos son del usuario).
router.use(verifyToken, requireRole(ROLES.CLIENTE));

router.get('/', getFavorites);
router.get('/ids', getFavoriteIds);
router.post('/:productId', addFavorite);
router.delete('/:productId', removeFavorite);

module.exports = router;
