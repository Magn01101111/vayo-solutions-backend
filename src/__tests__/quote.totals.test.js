/**
 * Tests de cálculo de totales de cotización (VAYO-T01).
 * Verifican la lógica pura de precio real (oferta vs normal), subtotal,
 * descuento, IVA y total sin necesitar base de datos.
 */

// ── Helper: replica la lógica de createQuote ─────────────────────────────────
// Esta función extrae la lógica pura que existe en quote.controller.js.

function isProductOnOffer(product, now = new Date()) {
  return (
    product.offerPrice != null &&
    product.offerPrice > 0 &&
    product.offerPrice < (product.price ?? Infinity) &&
    (!product.offerStartsAt || product.offerStartsAt <= now) &&
    (!product.offerEndsAt || product.offerEndsAt >= now)
  );
}

function calculateQuoteTotals({ items, productMap, ivaPercent = 19, discount = 0, shippingCost = 0 }) {
  const ivaRate = ivaPercent / 100;
  let subtotal = 0;
  const validItems = [];

  for (const it of items) {
    const product = productMap[String(it.productId)];
    if (!product || !product.isActive || product.price == null) continue;

    const realPrice = isProductOnOffer(product) ? product.offerPrice : product.price;
    const quantity = Math.max(1, Number(it.quantity) || 1);
    const itemTotal = realPrice * quantity;
    subtotal += itemTotal;
    validItems.push({ ...it, price: realPrice, total: itemTotal });
  }

  const taxableBase = Math.max(0, subtotal - discount);
  const iva = Math.round(taxableBase * ivaRate);
  const total = taxableBase + iva + shippingCost;

  return { subtotal, discount, taxableBase, iva, total, items: validItems };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const PRODUCT_A = { _id: 'p1', name: 'Producto A', price: 10000, isActive: true };
const PRODUCT_B = { _id: 'p2', name: 'Producto B', price: 20000, isActive: true };
const PRODUCT_OFFER = {
  _id: 'p3',
  name: 'Oferta',
  price: 10000,
  offerPrice: 7000,
  isActive: true,
  offerStartsAt: null,
  offerEndsAt: null,
};

describe('isProductOnOffer', () => {
  test('producto normal sin offerPrice no está en oferta', () => {
    expect(isProductOnOffer(PRODUCT_A)).toBe(false);
  });

  test('producto con offerPrice menor al price está en oferta (sin fechas)', () => {
    expect(isProductOnOffer(PRODUCT_OFFER)).toBe(true);
  });

  test('oferta ignorada si offerEndsAt es pasado', () => {
    const p = { ...PRODUCT_OFFER, offerEndsAt: new Date(Date.now() - 1000) };
    expect(isProductOnOffer(p)).toBe(false);
  });

  test('oferta ignorada si offerStartsAt es futuro', () => {
    const p = { ...PRODUCT_OFFER, offerStartsAt: new Date(Date.now() + 86400000) };
    expect(isProductOnOffer(p)).toBe(false);
  });

  test('oferta activa dentro del rango de fechas', () => {
    const p = {
      ...PRODUCT_OFFER,
      offerStartsAt: new Date(Date.now() - 1000),
      offerEndsAt: new Date(Date.now() + 86400000),
    };
    expect(isProductOnOffer(p)).toBe(true);
  });

  test('offerPrice mayor o igual al price no aplica como oferta', () => {
    const p = { ...PRODUCT_OFFER, offerPrice: 10000 }; // igual al precio normal
    expect(isProductOnOffer(p)).toBe(false);
  });
});

describe('calculateQuoteTotals', () => {
  test('calcula subtotal, IVA 19% y total correctamente', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 2 }],
      productMap: { p1: PRODUCT_A },
      ivaPercent: 19,
    });
    expect(t.subtotal).toBe(20000);           // 10000 × 2
    expect(t.taxableBase).toBe(20000);
    expect(t.iva).toBe(Math.round(20000 * 0.19)); // 3800
    expect(t.total).toBe(20000 + 3800);       // 23800
  });

  test('usa precio de oferta cuando está vigente', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p3', quantity: 1 }],
      productMap: { p3: PRODUCT_OFFER },
      ivaPercent: 19,
    });
    expect(t.subtotal).toBe(7000); // precio de oferta
    expect(t.items[0].price).toBe(7000);
  });

  test('aplica descuento antes del IVA', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 1 }],
      productMap: { p1: PRODUCT_A },
      ivaPercent: 19,
      discount: 2000,
    });
    const taxableBase = 10000 - 2000;         // 8000
    expect(t.taxableBase).toBe(taxableBase);
    expect(t.iva).toBe(Math.round(taxableBase * 0.19)); // 1520
    expect(t.total).toBe(taxableBase + 1520); // 9520
  });

  test('agrega costo de envío al total sin afectar IVA', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 1 }],
      productMap: { p1: PRODUCT_A },
      ivaPercent: 19,
      shippingCost: 3500,
    });
    const expectedIva = Math.round(10000 * 0.19);
    expect(t.iva).toBe(expectedIva);
    expect(t.total).toBe(10000 + expectedIva + 3500);
  });

  test('excluye productos inactivos', () => {
    const inactiveProduct = { ...PRODUCT_A, isActive: false };
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 1 }],
      productMap: { p1: inactiveProduct },
      ivaPercent: 19,
    });
    expect(t.subtotal).toBe(0);
    expect(t.items).toHaveLength(0);
  });

  test('IVA configurable: tasa 21%', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 1 }],
      productMap: { p1: PRODUCT_A },
      ivaPercent: 21,
    });
    expect(t.iva).toBe(Math.round(10000 * 0.21)); // 2100
  });

  test('múltiples ítems se suman correctamente', () => {
    const t = calculateQuoteTotals({
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      productMap: { p1: PRODUCT_A, p2: PRODUCT_B },
      ivaPercent: 19,
    });
    expect(t.subtotal).toBe(10000 * 2 + 20000 * 1); // 40000
  });

  test('descuento mayor al subtotal no genera base negativa', () => {
    const t = calculateQuoteTotals({
      items: [{ productId: 'p1', quantity: 1 }],
      productMap: { p1: PRODUCT_A },
      ivaPercent: 19,
      discount: 999999,
    });
    expect(t.taxableBase).toBe(0);
    expect(t.iva).toBe(0);
    expect(t.total).toBe(0);
  });
});
