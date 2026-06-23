const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Client = require('../models/client.model');
const Quote = require('../models/quote.model');
const Sale = require('../models/sale.model');
const Coupon = require('../models/coupon.model');
const { ok, serverError } = require('../utils/response');

// ── GET /api/stats/dashboard ──────────────────────────────────────────────────
// Devuelve métricas agregadas para el panel admin.
async function getDashboardStats(req, res) {
  try {
    const [
      productCount,
      categoryCount,
      clientCount,
      quoteCount,
      sales,
      quotes,
      couponsRedeemed,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true }),
      Client.countDocuments({ isActive: true }),
      Quote.countDocuments({}),
      Sale.find({}).select('totals status createdAt items').lean(),
      Quote.find({}).select('metadata createdAt coupon totals').lean(),
      // Cupones efectivamente consumidos (al menos un uso registrado).
      Coupon.countDocuments({ usedCount: { $gt: 0 } }),
    ]);

    // ── Ingresos: suma de ventas no anuladas ────────────────────────────────
    const validSales = sales.filter((s) => s.status !== 'cancelled');
    const totalRevenue = validSales.reduce((acc, s) => acc + (s.totals?.total ?? 0), 0);
    const paidRevenue = sales
      .filter((s) => s.status === 'paid')
      .reduce((acc, s) => acc + (s.totals?.total ?? 0), 0);

    // ── Tasa de conversión: ventas / cotizaciones ───────────────────────────
    const conversionRate = quoteCount > 0
      ? Math.round((sales.length / quoteCount) * 100)
      : 0;

    // ── Ventas por mes (últimos 6 meses) ────────────────────────────────────
    const salesByMonth = buildMonthlySeries(validSales, 6);

    // ── Cotizaciones por estado ─────────────────────────────────────────────
    const quotesByStatus = { sent: 0, accepted: 0, rejected: 0, expired: 0 };
    quotes.forEach((q) => {
      const st = q.metadata?.status || 'sent';
      if (quotesByStatus[st] !== undefined) quotesByStatus[st]++;
    });

    // ── Top productos por cantidad vendida ──────────────────────────────────
    const productTally = {};
    validSales.forEach((s) => {
      (s.items || []).forEach((it) => {
        const key = it.name || it.productId || 'Sin nombre';
        if (!productTally[key]) productTally[key] = { name: key, qty: 0, revenue: 0 };
        productTally[key].qty += it.quantity ?? 0;
        productTally[key].revenue += it.total ?? 0;
      });
    });
    const topProducts = Object.values(productTally)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // ── Cupones: ahorro total otorgado (suma de descuentos en cotizaciones) ──
    const couponSavings = quotes.reduce(
      (acc, q) => acc + (q.coupon?.code ? (q.totals?.discount ?? 0) : 0),
      0,
    );

    return ok(res, {
      counters: {
        products: productCount,
        categories: categoryCount,
        clients: clientCount,
        quotes: quoteCount,
        sales: sales.length,
      },
      revenue: {
        total: totalRevenue,
        paid: paidRevenue,
      },
      conversionRate,
      salesByMonth,
      quotesByStatus,
      topProducts,
      coupons: {
        redeemed: couponsRedeemed,
        savings: couponSavings,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

/**
 * Construye una serie de los últimos N meses con el total vendido en cada uno.
 * @returns [{ label: 'ene', total: 12345 }, ...]
 */
function buildMonthlySeries(sales, months) {
  const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const now = new Date();
  const series = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    series.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      total: 0,
    });
  }

  const indexByKey = {};
  series.forEach((s, idx) => { indexByKey[s.key] = idx; });

  sales.forEach((s) => {
    const d = new Date(s.createdAt);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (indexByKey[key] !== undefined) {
      series[indexByKey[key]].total += s.totals?.total ?? 0;
    }
  });

  return series.map(({ label, total, year }) => ({ label, total, year }));
}

module.exports = { getDashboardStats };
