const { evaluateCoupon } = require('../controllers/coupon.controller');

// coupon.controller importa Coupon (mongoose), pero evaluateCoupon es una función pura
// que solo usa el objeto recibido → no se necesita base de datos.

function makeCoupon(overrides = {}) {
  return {
    isActive: true,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
    minSubtotal: 0,
    type: 'percentage',
    value: 10,
    ...overrides,
  };
}

describe('evaluateCoupon', () => {
  test('retorna inválido si el cupón es null', () => {
    const r = evaluateCoupon(null, 10000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('Cupón no encontrado');
  });

  test('retorna inválido si el cupón está inactivo', () => {
    const r = evaluateCoupon(makeCoupon({ isActive: false }), 10000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('Cupón no disponible');
  });

  test('retorna inválido si el cupón está expirado', () => {
    const past = new Date(Date.now() - 1000);
    const r = evaluateCoupon(makeCoupon({ validUntil: past }), 10000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('Cupón expirado');
  });

  test('acepta cupón sin validUntil', () => {
    const r = evaluateCoupon(makeCoupon({ validUntil: null }), 10000);
    expect(r.valid).toBe(true);
  });

  test('acepta cupón con validUntil en el futuro', () => {
    const future = new Date(Date.now() + 86400000);
    const r = evaluateCoupon(makeCoupon({ validUntil: future }), 10000);
    expect(r.valid).toBe(true);
  });

  test('retorna inválido si se agotaron los usos', () => {
    const r = evaluateCoupon(makeCoupon({ maxUses: 5, usedCount: 5 }), 10000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('Cupón agotado');
  });

  test('acepta cupón cuando quedan usos disponibles', () => {
    const r = evaluateCoupon(makeCoupon({ maxUses: 5, usedCount: 4 }), 10000);
    expect(r.valid).toBe(true);
  });

  test('acepta cupón con maxUses null (usos ilimitados)', () => {
    const r = evaluateCoupon(makeCoupon({ maxUses: null, usedCount: 9999 }), 10000);
    expect(r.valid).toBe(true);
  });

  test('retorna inválido si el subtotal no alcanza el mínimo', () => {
    const r = evaluateCoupon(makeCoupon({ minSubtotal: 50000 }), 10000);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/subtotal mínimo/);
  });

  test('acepta cupón cuando el subtotal supera el mínimo', () => {
    const r = evaluateCoupon(makeCoupon({ minSubtotal: 5000 }), 10000);
    expect(r.valid).toBe(true);
  });

  test('calcula descuento porcentual correctamente', () => {
    const r = evaluateCoupon(makeCoupon({ type: 'percentage', value: 10 }), 100000);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(10000);
  });

  test('descuento porcentual redondea correctamente', () => {
    const r = evaluateCoupon(makeCoupon({ type: 'percentage', value: 10 }), 99999);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(Math.round(99999 * 0.1));
  });

  test('calcula descuento fijo correctamente', () => {
    const r = evaluateCoupon(makeCoupon({ type: 'fixed', value: 5000 }), 100000);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(5000);
  });

  test('descuento fijo no supera el subtotal', () => {
    const r = evaluateCoupon(makeCoupon({ type: 'fixed', value: 200000 }), 10000);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(10000); // capped al subtotal
  });
});
