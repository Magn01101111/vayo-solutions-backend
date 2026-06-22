const Notification = require('../models/notification.model');
const { ROLES } = require('../constants/roles');
const { ok, fail, notFound, serverError } = require('../utils/response');

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.COTIZADOR];

function recipientFilter(user) {
  if (ADMIN_ROLES.includes(user.role)) {
    return { $or: [{ recipientRole: 'admin' }, { recipientUserId: user.id }] };
  }
  return { recipientUserId: user.id };
}

// GET /api/notifications
async function getNotifications(req, res) {
  try {
    const filter = recipientFilter(req.user);
    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unread = items.filter((n) => !n.read).length;
    return ok(res, { items: items.map(mapNotification), unread });
  } catch (error) {
    return serverError(res, error);
  }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { read: true } },
      { new: true },
    );
    if (!notif) return notFound(res, 'Notificación no encontrada');
    return ok(res, { id: notif._id });
  } catch (error) {
    return serverError(res, error);
  }
}

// POST /api/notifications/read-all
async function markAllRead(req, res) {
  try {
    const filter = { ...recipientFilter(req.user), read: false };
    const result = await Notification.updateMany(filter, { $set: { read: true } });
    return ok(res, { updated: result.modifiedCount });
  } catch (error) {
    return serverError(res, error);
  }
}

function mapNotification(n) {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  };
}

module.exports = { getNotifications, markRead, markAllRead };
