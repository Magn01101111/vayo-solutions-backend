const { consumeCoupon, evaluateCoupon } = require('../controllers/coupon.controller');

// consumeCoupon es una función pura que muta el objeto recibido (sin BD).

describe('consumeCoupon', () => {
  test('incrementa usedCount en 1', () => {
    const c = { usedCount: 0, maxUses: null };
    consumeCoupon(c);
    expect(c.usedCount).toBe(1);
  });

  test('incrementa desde un usedCount previo', () => {
    const c = { usedCount: 3, maxUses: 10 };
    consumeCoupon(c);
    expect(c.usedCount).toBe(4);
  });

  test('NO marca canje si maxUses != 1', () => {
    const c = { usedCount: 0, maxUses: 5 };
    consumeCoupon(c, 'user-a');
    expect(c.usedCount).toBe(1);
    expect(c.redeemedAt == null).toBe(true);
    expect(c.redeemedBy == null).toBe(true);
  });

  test('marca redeemedAt/redeemedBy si es de uso único (maxUses === 1)', () => {
    const c = { usedCount: 0, maxUses: 1 };
    consumeCoupon(c, 'user-a');
    expect(c.usedCount).toBe(1);
    expect(c.redeemedAt instanceof Date).toBe(true);
    expect(c.redeemedBy).toBe('user-a');
  });

  test('uso único sin userId deja redeemedBy en null', () => {
    const c = { usedCount: 0, maxUses: 1 };
    consumeCoupon(c);
    expect(c.redeemedAt instanceof Date).toBe(true);
    expect(c.redeemedBy).toBe(null);
  });

  test('tras consumir un cupón de uso único, evaluateCoupon lo rechaza por agotado', () => {
    const c = {
      isActive: true,
      validUntil: null,
      minSubtotal: 0,
      type: 'percentage',
      value: 15,
      usedCount: 0,
      maxUses: 1,
      ownerUserId: 'user-a',
    };
    // Primer uso: válido para el titular.
    expect(evaluateCoupon(c, 10000, 'user-a').valid).toBe(true);
    consumeCoupon(c, 'user-a');
    // Segundo intento del mismo cupón welcome: agotado.
    const r = evaluateCoupon(c, 10000, 'user-a');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('Cupón agotado');
  });
});
