const express = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { getNotifications, markRead, markAllRead } = require('../controllers/notification.controller');

const router = express.Router();

router.get('/',           verifyToken, getNotifications);
router.patch('/:id/read', verifyToken, markRead);
router.post('/read-all',  verifyToken, markAllRead);

module.exports = router;
