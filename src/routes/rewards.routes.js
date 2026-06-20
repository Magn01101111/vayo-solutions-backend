const express = require('express');
const { claimReward } = require('../controllers/rewards.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// POST /api/rewards/claim — CLIENTE reclama cupón por uso del escáner
router.post('/claim', verifyToken, requireRole(ROLES.CLIENTE), claimReward);

module.exports = router;
