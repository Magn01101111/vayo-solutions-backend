const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants/roles');

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_DURATION_MS =
  (Number(process.env.LOCK_DURATION_MINUTES) || 30) * 60 * 1000;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // nunca se envía por defecto en queries
    },
    phone: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      trim: true, // cargo del usuario
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CLIENTE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    profileImage: {
      type: String,
      trim: true,
    },

    // ── Seguridad ─────────────────────────────────────────────────────────────
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // ── Recuperación de contraseña ────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Métodos de instancia ──────────────────────────────────────────────────────

/** Compara una contraseña en texto plano con el hash almacenado */
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

/** Retorna true si la cuenta está actualmente bloqueada */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/** Incrementa intentos fallidos; bloquea la cuenta al alcanzar el máximo */
userSchema.methods.incrementLoginAttempts = async function () {
  // Si el bloqueo anterior ya expiró, reiniciar contadores
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1, lockUntil: null } });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }

  return this.updateOne(updates);
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Hash automático de contraseña antes de guardar.
 * En Mongoose 9, los async hooks resuelven la promesa automáticamente
 * sin necesidad de llamar next().
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

module.exports = mongoose.model('User', userSchema);
