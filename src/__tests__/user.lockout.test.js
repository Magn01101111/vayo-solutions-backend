/**
 * Tests de lógica de bloqueo de cuentas (login lockout).
 * Se testea la lógica pura sin instanciar modelos de Mongoose.
 */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutos

// Réplica de la lógica del modelo User para tests unitarios puros
function isLocked(user) {
  return !!(user.lockUntil && user.lockUntil > Date.now());
}

function simulateIncrementAttempts(user) {
  // Replica la lógica de user.methods.incrementLoginAttempts
  if (user.lockUntil && user.lockUntil < Date.now()) {
    // Bloqueo expirado: reiniciar
    user.loginAttempts = 1;
    user.lockUntil = null;
    return;
  }
  user.loginAttempts += 1;
  if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
  }
}

describe('isLocked', () => {
  test('cuenta sin lockUntil no está bloqueada', () => {
    expect(isLocked({ lockUntil: null, loginAttempts: 0 })).toBe(false);
  });

  test('cuenta con lockUntil pasado no está bloqueada', () => {
    const user = { lockUntil: new Date(Date.now() - 1000), loginAttempts: 5 };
    expect(isLocked(user)).toBe(false);
  });

  test('cuenta con lockUntil en el futuro está bloqueada', () => {
    const user = { lockUntil: new Date(Date.now() + 60000), loginAttempts: 5 };
    expect(isLocked(user)).toBe(true);
  });
});

describe('incrementLoginAttempts', () => {
  test('incrementa el contador de intentos en cada fallo', () => {
    const user = { loginAttempts: 0, lockUntil: null };
    simulateIncrementAttempts(user);
    expect(user.loginAttempts).toBe(1);
  });

  test('bloquea la cuenta al alcanzar el máximo de intentos', () => {
    const user = { loginAttempts: MAX_LOGIN_ATTEMPTS - 1, lockUntil: null };
    simulateIncrementAttempts(user);
    expect(user.loginAttempts).toBe(MAX_LOGIN_ATTEMPTS);
    expect(user.lockUntil).not.toBeNull();
    expect(isLocked(user)).toBe(true);
  });

  test('no bloquea antes de alcanzar el máximo', () => {
    const user = { loginAttempts: 2, lockUntil: null };
    simulateIncrementAttempts(user);
    expect(user.lockUntil).toBeNull();
    expect(isLocked(user)).toBe(false);
  });

  test('reinicia contadores cuando el bloqueo ya expiró', () => {
    const user = {
      loginAttempts: MAX_LOGIN_ATTEMPTS,
      lockUntil: new Date(Date.now() - 1000), // bloqueo expirado
    };
    simulateIncrementAttempts(user);
    expect(user.loginAttempts).toBe(1);
    expect(user.lockUntil).toBeNull();
  });

  test('lockUntil es aproximadamente 30 min desde ahora', () => {
    const user = { loginAttempts: MAX_LOGIN_ATTEMPTS - 1, lockUntil: null };
    const before = Date.now();
    simulateIncrementAttempts(user);
    const after = Date.now();

    const lockMs = user.lockUntil.getTime();
    expect(lockMs).toBeGreaterThanOrEqual(before + LOCK_DURATION_MS - 10);
    expect(lockMs).toBeLessThanOrEqual(after + LOCK_DURATION_MS + 10);
  });
});
