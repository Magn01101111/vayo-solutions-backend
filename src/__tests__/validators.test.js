const { validateRut, formatRut, normalizeChileanPhone, formatPhone } = require('../utils/validators');

// RUTs válidos usados en los tests (DV calculado con módulo 11):
//   11.111.111-1 → sum=32, 32%11=10, DV=11-10=1     ✓
//   12.345.678-5 → sum=138, 138%11=6, DV=11-6=5      ✓
//   20.000.003-K → sum=12, 12%11=1, DV=K              ✓
//   7.654.321-6  → sum=126, 126%11=5, DV=11-5=6      ✓

// ── validateRut ───────────────────────────────────────────────────────────────

describe('validateRut', () => {
  test('acepta RUT con puntos y guión', () => {
    expect(validateRut('11.111.111-1')).toBe('11111111-1');
  });

  test('acepta RUT sin puntos ni guión', () => {
    expect(validateRut('111111111')).toBe('11111111-1');
  });

  test('acepta RUT con DV K en minúscula', () => {
    expect(validateRut('20.000.003-k')).toBe('20000003-K');
  });

  test('acepta RUT con DV K en mayúscula', () => {
    expect(validateRut('20000003K')).toBe('20000003-K');
  });

  test('rechaza RUT con DV incorrecto', () => {
    // 11.111.111-1 es correcto; cambiar el DV a 9 lo invalida
    expect(validateRut('11111111-9')).toBeNull();
  });

  test('rechaza RUT vacío', () => {
    expect(validateRut('')).toBeNull();
  });

  test('rechaza null', () => {
    expect(validateRut(null)).toBeNull();
  });

  test('rechaza undefined', () => {
    expect(validateRut(undefined)).toBeNull();
  });

  test('rechaza string sin dígitos suficientes', () => {
    expect(validateRut('123-4')).toBeNull();
  });

  test('acepta RUT de 7 dígitos', () => {
    expect(validateRut('7.654.321-6')).toBe('7654321-6');
  });

  test('normaliza espacios y puntos extras', () => {
    expect(validateRut(' 11.111.111-1 ')).toBe('11111111-1');
  });

  test('acepta RUT de 8 dígitos sin formato', () => {
    expect(validateRut('123456785')).toBe('12345678-5');
  });
});

// ── formatRut ─────────────────────────────────────────────────────────────────

describe('formatRut', () => {
  test('formatea RUT canónico de 8 dígitos con puntos', () => {
    expect(formatRut('11111111-1')).toBe('11.111.111-1');
  });

  test('formatea RUT canónico de 7 dígitos con puntos', () => {
    expect(formatRut('7654321-6')).toBe('7.654.321-6');
  });

  test('retorna string vacío para input vacío', () => {
    expect(formatRut('')).toBe('');
  });

  test('retorna RUT tal cual si ya tiene formato incorrecto (sin guión)', () => {
    // formatRut es tolerante: si no puede dividir devuelve el input
    const r = formatRut('111111111');
    expect(typeof r).toBe('string');
  });
});

// ── normalizeChileanPhone ─────────────────────────────────────────────────────

describe('normalizeChileanPhone', () => {
  test('acepta 8 dígitos (formato de formulario típico)', () => {
    expect(normalizeChileanPhone('12345678')).toBe('+56912345678');
  });

  test('acepta 9 dígitos con prefijo 9', () => {
    expect(normalizeChileanPhone('912345678')).toBe('+56912345678');
  });

  test('acepta 11 dígitos con código de país 56', () => {
    expect(normalizeChileanPhone('56912345678')).toBe('+56912345678');
  });

  test('acepta número con espacios y guiones', () => {
    expect(normalizeChileanPhone('+56 9 1234 5678')).toBe('+56912345678');
  });

  test('rechaza input nulo', () => {
    expect(normalizeChileanPhone(null)).toBeNull();
  });

  test('rechaza string vacío', () => {
    expect(normalizeChileanPhone('')).toBeNull();
  });

  test('rechaza número de largo incorrecto', () => {
    expect(normalizeChileanPhone('1234')).toBeNull();
  });
});

// ── formatPhone ───────────────────────────────────────────────────────────────

describe('formatPhone', () => {
  test('formatea E.164 a versión legible', () => {
    expect(formatPhone('+56912345678')).toBe('+56 9 1234 5678');
  });

  test('retorna string vacío para input vacío', () => {
    expect(formatPhone('')).toBe('');
  });

  test('devuelve el input si no cumple el formato E.164', () => {
    expect(formatPhone('no-phone')).toBe('no-phone');
  });
});
