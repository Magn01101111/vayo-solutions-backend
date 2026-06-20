const express = require('express');
const { getCart, saveCart } = require('../controllers/cart.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/',  verifyToken, getCart);
router.put('/',  verifyToken, saveCart);

module.exports = router;
