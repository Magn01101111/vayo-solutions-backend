const DeviceToken = require('../models/device-token.model');
const { ok, fail, serverError } = require('../utils/response');

// POST /api/devices/push-token — registra o actualiza el token FCM del dispositivo
async function registerToken(req, res) {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') {
      return fail(res, 'Token FCM requerido');
    }
    const allowed = ['android', 'ios', 'web'];
    const plat = allowed.includes(platform) ? platform : 'android';

    await DeviceToken.findOneAndUpdate(
      { userId: req.user.id, token },
      { $set: { platform: plat, active: true } },
      { upsert: true },
    );

    return ok(res, { registered: true });
  } catch (error) {
    return serverError(res, error);
  }
}

// DELETE /api/devices/push-token — desregistra el token (logout / opt-out)
async function removeToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return fail(res, 'Token requerido');
    await DeviceToken.updateOne(
      { userId: req.user.id, token },
      { $set: { active: false } },
    );
    return ok(res, { removed: true });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { registerToken, removeToken };
