const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Client = require('../models/client.model');
const Coupon = require('../models/coupon.model');
const { ROLES } = require('../constants/roles');
const { validateRut, normalizeChileanPhone } = require('../utils/validators');
const { sendPasswordResetEmail } = require('../services/email.service');
const { uploadBuffer } = require('../services/cloudinary.service');
const {
  ok,
  created,
  fail,
  unauthorized,
  conflict,
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
    {
      id: user._id,
      role: user.role,
      clientId: user.clientId ?? null, // necesario para filtrar cotizaciones del CLIENTE
    },
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
    clientId: user.clientId ?? null,
  };
}

/**
 * Emite el cupón de bienvenida (15%, uso único, 30 días) atado al nuevo CLIENTE.
 * Reintenta con sufijo aleatorio ante una colisión de código (improbable con
 * ObjectId, pero el índice `code` es único). Devuelve un resumen del cupón o
 * lanza si no logra generar un código libre tras varios intentos.
 */
async function issueWelcomeCoupon(userId) {
  const base = `BIENVENIDA${userId.toString().slice(-6).toUpperCase()}`;
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  for (let intento = 0; intento < 5; intento += 1) {
    const code =
      intento === 0
        ? base
        : `${base}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

    if (await Coupon.findOne({ code })) continue;

    try {
      const coupon = await Coupon.create({
        code,
        type: 'percentage',
        value: 15,
        description: 'Cupón de bienvenida — 15% en tu primera cotización',
        maxUses: 1,
        validUntil,
        ownerUserId: userId,
        origin: 'welcome',
        isActive: true,
      });
      return {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description,
        validUntil: coupon.validUntil,
      };
    } catch (err) {
      if (err.code === 11000) continue; // colisión del índice único → reintentar
      throw err;
    }
  }
  throw new Error('No se pudo generar un código de cupón único');
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Auto-registro público — crea atómicamente:
//   1. User[CLIENTE]   (auth)
//   2. Client          (CRM, vinculado al user)
// Si cualquiera de los dos falla, se revierte todo (transacción).
async function register(req, res) {
  const session = await mongoose.startSession();

  try {
    const { name, email, password, phone, rut } = req.body;

    // ── Validar RUT (obligatorio en self-registration) ────────────────────────
    const canonicalRut = validateRut(rut);
    if (!canonicalRut) {
      return fail(res, 'RUT inválido. Verifica el dígito verificador.');
    }

    // ── Normalizar teléfono (obligatorio para CLIENTE) ────────────────────────
    const canonicalPhone = normalizeChileanPhone(phone);
    if (!canonicalPhone) {
      return fail(res, 'Teléfono inválido. Debe ser un móvil chileno (8 dígitos tras el 9).');
    }

    // ── Verificar email único ─────────────────────────────────────────────────
    const existsEmail = await User.findOne({ email });
    if (existsEmail) return conflict(res, 'El correo ya está registrado');

    // ── Buscar Client existente por RUT ───────────────────────────────────────
    // Puede existir si el usuario ya compró como invitado. En ese caso:
    //   - Si NO tiene cuenta de portal → la vinculamos (escenario post-compra).
    //   - Si YA tiene cuenta de portal → rechazamos (RUT con usuario activo).
    const existingClient = await Client.findOne({ rut: canonicalRut });
    if (existingClient && existingClient.userId) {
      return conflict(res, 'El RUT ya tiene una cuenta asociada. Inicia sesión.');
    }

    let user, client;

    await session.withTransaction(async () => {
      // 1. Crear el User (sin clientId aún)
      const [createdUser] = await User.create(
        [{
          name,
          email,
          password,
          phone: canonicalPhone,
          role: ROLES.CLIENTE,
        }],
        { session }
      );

      if (existingClient) {
        // 2a. Reutilizar el Client de invitado: vincularlo a la nueva cuenta.
        existingClient.userId = createdUser._id;
        if (!existingClient.email) existingClient.email = email;
        if (!existingClient.phone) existingClient.phone = canonicalPhone;
        await existingClient.save({ session });
        client = existingClient;
      } else {
        // 2b. Crear un Client CRM nuevo vinculado al user.
        const [createdClient] = await Client.create(
          [{
            name,
            email,
            phone: canonicalPhone,
            rut: canonicalRut,
            userId: createdUser._id,
            createdBy: null, // se auto-registró, no lo creó un cotizador
          }],
          { session }
        );
        client = createdClient;
      }

      // 3. Vincular el User al Client
      createdUser.clientId = client._id;
      await createdUser.save({ session });

      user = createdUser;
    });

    const token = generateToken(user);

    // Cupón de bienvenida (15%): se emite FUERA de la transacción para que un
    // fallo aquí no revierta el registro. Si no se puede emitir, se omite.
    let welcomeCoupon = null;
    try {
      welcomeCoupon = await issueWelcomeCoupon(user._id);
    } catch (couponErr) {
      console.error('No se pudo emitir el cupón de bienvenida:', couponErr.message);
    }

    return created(res, {
      token,
      user: mapUserPublic(user),
      redirectTo: ROLE_REDIRECT[ROLES.CLIENTE],
      welcomeCoupon,
    });
  } catch (error) {
    return serverError(res, error);
  } finally {
    session.endSession();
  }
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
      const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
      const left = Math.max(0, maxAttempts - user.loginAttempts);
      return res.status(401).json({
        ok: false,
        error: 'Credenciales inválidas',
        attemptsLeft: left,
      });
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

    // Tomar la primera URL en caso de que FRONTEND_URL tenga múltiples valores
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:4200')
      .split(',')[0]
      .trim();
    const resetUrl = `${frontendBase}/reset-password?token=${token}`;
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

// ── PATCH /api/auth/me ────────────────────────────────────────────────────────
// Permite a cualquier usuario autenticado actualizar su nombre y teléfono.
async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return notFound(res, 'Usuario no encontrado');

    const { name, phone } = req.body;

    if (name?.trim()) user.name = name.trim();

    if (phone !== undefined) {
      if (!phone || phone === '') {
        user.phone = '';
      } else {
        const canonical = normalizeChileanPhone(phone);
        if (!canonical) return fail(res, 'Teléfono inválido. Debe ser un móvil chileno (ej. 9 1234 5678).');
        user.phone = canonical;
      }
    }

    await user.save();
    return ok(res, mapUserPublic(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/auth/me/photo ──────────────────────────────────────────────────
// Sube la foto de perfil a Cloudinary y actualiza User.profileImage.
// Requiere multipart/form-data con campo "photo".
async function uploadProfilePhotoHandler(req, res) {
  try {
    if (!req.file) return fail(res, 'No se recibió ninguna imagen');

    const user = await User.findById(req.user.id);
    if (!user) return notFound(res, 'Usuario no encontrado');

    const { url } = await uploadBuffer(req.file.buffer, 'vayo/profiles');
    user.profileImage = url;
    await user.save();

    return ok(res, mapUserPublic(user));
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  uploadProfilePhotoHandler,
  changePassword,
  requestPasswordReset,
  confirmPasswordReset,
};
