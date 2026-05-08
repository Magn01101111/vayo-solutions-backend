/**
 * Validadores y normalizadores para datos chilenos.
 *
 * Convención: las funciones retornan el valor canónico si es válido,
 * o `null` si es inválido. Nunca lanzan excepciones.
 */

// ── RUT chileno ──────────────────────────────────────────────────────────────
//
// Formato canónico de almacenamiento: "12345678-9" (sin puntos, K en mayúscula).
// Se acepta en input cualquier forma común: "12.345.678-9", "123456789", etc.

/**
 * Normaliza un RUT y valida el dígito verificador.
 * @param   {string} input - cualquier forma de RUT
 * @returns {string|null} - RUT canónico "12345678-9" o null si es inválido
 */
function validateRut(input) {
  if (input === null || input === undefined) return null;

  // Limpiar: quitar puntos, guiones, espacios; pasar K a mayúscula
  const cleaned = String(input).replace(/[.\-\s]/g, '').toUpperCase();

  // Formato esperado: 7 u 8 dígitos seguidos del DV (0-9 o K)
  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return null;

  const body = cleaned.slice(0, -1);
  const dv   = cleaned.slice(-1);

  // Algoritmo módulo 11
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = sum % 11;
  const expected =
    remainder === 0 ? '0' :
    remainder === 1 ? 'K' :
    String(11 - remainder);

  if (dv !== expected) return null;

  return `${body}-${dv}`;
}

/**
 * Formatea un RUT canónico a su versión legible con puntos.
 * @param   {string} canonicalRut - "12345678-9"
 * @returns {string}              - "12.345.678-9"
 */
function formatRut(canonicalRut) {
  if (!canonicalRut) return '';
  const [body, dv] = canonicalRut.split('-');
  if (!body || !dv) return canonicalRut;
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots}-${dv}`;
}

// ── Teléfono chileno (estándar E.164) ────────────────────────────────────────
//
// Formato canónico de almacenamiento: "+56912345678" (E.164, móvil chileno).
// Se acepta en input: "+56 9 1234 5678", "912345678", "9 1234 5678", "12345678".

const CL_COUNTRY_CODE = '56';
const CL_MOBILE_PREFIX = '9';

/**
 * Normaliza un teléfono móvil chileno a formato E.164.
 * @param   {string} input
 * @returns {string|null} - "+56912345678" o null si no es un móvil chileno válido
 */
function normalizeChileanPhone(input) {
  if (input === null || input === undefined || input === '') return null;

  // Quedarse solo con dígitos
  const digits = String(input).replace(/\D/g, '');

  // Caso 1: ya tiene código país completo "569XXXXXXXX" (11 dígitos)
  if (digits.length === 11 && digits.startsWith(CL_COUNTRY_CODE + CL_MOBILE_PREFIX)) {
    return `+${digits}`;
  }

  // Caso 2: tiene el 9 inicial pero sin código país "9XXXXXXXX" (9 dígitos)
  if (digits.length === 9 && digits.startsWith(CL_MOBILE_PREFIX)) {
    return `+${CL_COUNTRY_CODE}${digits}`;
  }

  // Caso 3: solo los 8 dígitos del número (lo más común desde el form)
  if (digits.length === 8) {
    return `+${CL_COUNTRY_CODE}${CL_MOBILE_PREFIX}${digits}`;
  }

  return null;
}

/**
 * Formatea un teléfono E.164 a versión legible.
 * @param   {string} e164 - "+56912345678"
 * @returns {string}      - "+56 9 1234 5678"
 */
function formatPhone(e164) {
  if (!e164 || !/^\+56\d{9}$/.test(e164)) return e164 || '';
  // +56 9 1234 5678
  return `+56 ${e164.charAt(3)} ${e164.slice(4, 8)} ${e164.slice(8)}`;
}

module.exports = {
  validateRut,
  formatRut,
  normalizeChileanPhone,
  formatPhone,
};
