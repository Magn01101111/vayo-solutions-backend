const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const { sendPasswordResetEmail } = require('../services/email.service');
const {
  ok,
  fail,
  unauthorized,
  notFound,
  serverError,
} = require('../utils/response');

// Redirección de frontend según rol
const ROLE_REDIRECT = {
  [ROLES.ADMIN]:      '/admin',
  [ROLES.COTIZADOR]:  '/cotizador',
  [ROLES.PROVEEDOR]:  '/proveedor',
  [ROLES.CLIENTE]:    '/catalogo',
};

function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function mapUserPublic(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    position: user.position,
    profileImage: user.profileImage,
  };
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // select:false en password → hay que pedirlo explícitamente
    const user = await User.findOne({ email, isActive: true }).select(
      '+password +loginAttempts +lockUntil'
    );

    if (!user) {
      return unauthorized(res, 'Credenciales inválidas');
    }

    // Verificar bloqueo
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return fail(
        res,
        `Cuenta bloqueada por intentos fallidos. Intente nuevamente en ${minutesLeft} min.`,
        423
      );
    }

    const valid = await user.comparePassword(password);

    if (!valid) {
      await user.incrementLoginAttempts();
      return unauthorized(res, 'Credenciales inválidas');
    }

    // Restablecer intentos fallidos
    await User.updateOne(
      { _id: user._id },
      { $set: { loginAttempts: 0, lockUntil: null } }
    );

    const token = generateToken(user);

    return ok(res, {
      token,
      user: mapUserPublic(user),
      redirectTo: ROLE_REDIRECT[user.role] || '/',
    });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// JWT es stateless: el cliente elimina el token. El servidor confirma el logout.
function logout(_req, res) {
  return ok(res, { message: 'Sesión cerrada correctamente' });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return notFound(res, 'Usuario no encontrado');
    return ok(res, mapUserPublic(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/auth/me/password ─────────────────────────────────────────────────
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return notFound(res, 'Usuario no encontrado');

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return unauthorized(res, 'Contraseña actual incorrecta');

    user.password = newPassword;
    await user.save();

    return ok(res, { message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/auth/password-reset/request ────────────────────────────────────
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isActive: true });

    // Siempre respondemos 200 para no revelar si el email existe
    if (!user) {
      return ok(res, {
        message: 'Si el correo existe, recibirás las instrucciones.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        },
      }
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    return ok(res, {
      message: 'Si el correo existe, recibirás las instrucciones.',
    });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/auth/password-reset/confirm ────────────────────────────────────
async function confirmPasswordReset(req, res) {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return fail(res, 'Token inválido o expirado');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return ok(res, { message: 'Contraseña restablecida correctamente' });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  login,
  logout,
  getProfile,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
};
