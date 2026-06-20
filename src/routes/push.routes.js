const express = require('express');
const { registerToken, removeToken } = require('../controllers/push.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/push-token',   verifyToken, registerToken);
router.delete('/push-token', verifyToken, removeToken);

module.exports = router;
