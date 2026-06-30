const mongoose = require('mongoose');
const Sale    = require('../models/sale.model');
const Payment = require('../models/payment.model');
const tbk     = require('../services/transbank.service');
const { ROLES } = require('../constants/roles');
const { ok, created, fail, notFound, forbidden, serverError } = require('../utils/response');

// ── Helpers internos ───────────────────────────────────────────────────────────

/** buyOrder: máx 26 chars, sin espacios. */
function buildBuyOrder(saleId) {
  return `VAYO${String(saleId).slice(-8)}${Date.now().toString().slice(-8)}`;
}

/** sessionId: máx 61 chars. */
function buildSessionId(saleId) {
  return `SESS${String(saleId).slice(-20)}${Date.now().toString().slice(-8)}`;
}

/** URL base del backend (accesible por el browser del usuario). */
function backendUrl() {
  return process.env.BACKEND_URL || 'http://localhost:3000';
}

/** Primera URL del frontend (para redirigir el resultado). */
function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:4200')
    .split(',')[0]
    .trim();
}

// ── POST /api/payments/webpay/init ────────────────────────────────────────────
// Body: { saleId }
// Inicia un pago Webpay para una venta pendiente.
// Retorna { token, url, paymentId } — el frontend manda al usuario a Webpay.
async function initWebpay(req, res) {
  try {
    const { saleId } = req.body || {};

    if (!saleId || !mongoose.Types.ObjectId.isValid(saleId)) {
      return fail(res, 'saleId inválido o faltante');
    }

    const sale = await Sale.findById(saleId);
    if (!sale)                         return notFound(res, 'Venta no encontrada');

    // Un CLIENTE solo puede pagar SUS propias ventas (evita IDOR).
    if (
      req.user?.role === ROLES.CLIENTE &&
      (!req.user.clientId || String(sale.clientId) !== String(req.user.clientId))
    ) {
      return forbidden(res, 'No puedes pagar una venta que no te pertenece');
    }

    if (sale.status === 'paid')        return fail(res, 'Esta venta ya está pagada');
    if (sale.status === 'cancelled')   return fail(res, 'Esta venta está anulada');
    if (sale.currency !== 'CLP')       return fail(res, 'Webpay solo acepta pagos en CLP');

    const amount = Math.round(sale.totals?.total ?? 0);
    if (amount <= 0) return fail(res, 'El monto de la venta es inválido');

    // Cancelar intentos pendientes anteriores para esta venta
    await Payment.updateMany(
      { saleId, status: 'pending' },
      { $set: { status: 'cancelled' } },
    );

    const buyOrder  = buildBuyOrder(saleId);
    const sessionId = buildSessionId(saleId);
    const returnUrl = `${backendUrl()}/api/payments/webpay/return`;

    const tbkResp = await tbk.createTransaction({ buyOrder, sessionId, amount, returnUrl });

    const payment = await Payment.create({
      saleId,
      tbkToken:     tbkResp.token,
      tbkBuyOrder:  buyOrder,
      tbkSessionId: sessionId,
      amount,
      status: 'pending',
    });

    return created(res, {
      token:     tbkResp.token,
      url:       tbkResp.url,
      paymentId: payment._id,
    });
  } catch (error) {
    console.error('[Webpay init]', error?.message ?? error);
    return serverError(res, error);
  }
}

// ── POST /api/payments/webpay/return ──────────────────────────────────────────
// Webpay redirige el BROWSER del usuario aquí (POST con token_ws en el body).
// No requiere auth — es Webpay quien hace el POST.
// Al terminar redirige el browser al frontend con el resultado.
async function returnWebpay(req, res) {
  const base = frontendUrl();
  const toFront = (status, extra = '') =>
    res.redirect(`${base}/pago/resultado?status=${status}${extra}`);

  try {
    const token    = req.body?.token_ws;
    const tbkToken = req.body?.TBK_TOKEN; // presente cuando el usuario cancela en Webpay

    // Usuario canceló antes de pagar
    if (!token) {
      if (tbkToken) {
        await Payment.findOneAndUpdate(
          { tbkToken },
          { $set: { status: 'cancelled' } },
        );
      }
      return toFront('cancelled');
    }

    const payment = await Payment.findOne({ tbkToken: token });
    if (!payment) return toFront('error', '&msg=not_found');

    // Idempotencia: si este token ya fue procesado (Webpay reintenta el POST,
    // o el usuario refresca), NO volver a hacer commit — Transbank lo rechazaría.
    if (payment.status !== 'pending') {
      if (payment.status === 'authorized') {
        const paidSale = await Sale.findById(payment.saleId).select('folio').lean();
        const folio = encodeURIComponent(paidSale?.folio ?? '');
        const auth  = encodeURIComponent(payment.authorizationCode ?? '');
        return toFront('ok', `&folio=${folio}&auth=${auth}`);
      }
      if (payment.status === 'cancelled') return toFront('cancelled');
      return toFront('rejected');
    }

    const tbkResp = await tbk.commitTransaction(token);

    // Defensa anti-manipulación: el monto confirmado debe coincidir con el creado.
    if (typeof tbkResp.amount === 'number' && tbkResp.amount !== payment.amount) {
      await Payment.findByIdAndUpdate(payment._id, {
        $set: { status: 'failed', tbkResponse: tbkResp },
      });
      return toFront('error', '&msg=amount_mismatch');
    }

    if (tbkResp.response_code === 0 && tbkResp.status === 'AUTHORIZED') {
      // ✅ Pago autorizado
      await Payment.findByIdAndUpdate(payment._id, {
        $set: {
          status:            'authorized',
          tbkResponse:       tbkResp,
          authorizationCode: tbkResp.authorization_code ?? '',
          cardLast4:         tbkResp.card_detail?.card_number ?? '',
        },
      });

      const sale = await Sale.findByIdAndUpdate(
        payment.saleId,
        { $set: { status: 'paid', paymentMethod: 'card' } },
        { new: true },
      );

      const folio = encodeURIComponent(sale?.folio ?? '');
      const auth  = encodeURIComponent(tbkResp.authorization_code ?? '');
      return toFront('ok', `&folio=${folio}&auth=${auth}`);
    }

    // ❌ Pago rechazado
    await Payment.findByIdAndUpdate(payment._id, {
      $set: { status: 'failed', tbkResponse: tbkResp },
    });
    return toFront('rejected', `&code=${tbkResp.response_code ?? ''}`);

  } catch (error) {
    console.error('[Webpay return]', error?.message ?? error);
    return toFront('error');
  }
}

// ── GET /api/payments/webpay/status/:token ────────────────────────────────────
// Consulta el estado de una transacción directamente en Transbank (debug/admin).
async function statusWebpay(req, res) {
  try {
    const { token } = req.params;
    if (!token) return fail(res, 'Token requerido');

    const tbkResp = await tbk.statusTransaction(token);
    return ok(res, tbkResp);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/payments/sale/:saleId ────────────────────────────────────────────
// Lista todos los intentos de pago de una venta (historial de auditoría).
async function getPaymentsBySale(req, res) {
  try {
    const { saleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(saleId)) return fail(res, 'saleId inválido');

    // Solo ADMIN / COTIZADOR pueden ver esto
    const role = req.user?.role;
    if (role !== ROLES.ADMIN && role !== ROLES.COTIZADOR) return forbidden(res);

    const payments = await Payment.find({ saleId }).sort({ createdAt: -1 }).lean();
    return ok(res, payments);
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/payments/webpay/refund/:paymentId ───────────────────────────────
// Anula un pago autorizado. Solo ADMIN.
async function refundWebpay(req, res) {
  try {
    if (req.user?.role !== ROLES.ADMIN) return forbidden(res);

    const { paymentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(paymentId)) return fail(res, 'paymentId inválido');

    const payment = await Payment.findById(paymentId);
    if (!payment) return notFound(res, 'Pago no encontrado');
    if (payment.status !== 'authorized') {
      return fail(res, 'Solo se pueden anular pagos autorizados');
    }

    const tbkResp = await tbk.refundTransaction(payment.tbkToken, payment.amount);

    await Payment.findByIdAndUpdate(paymentId, {
      $set: { status: 'cancelled', tbkResponse: tbkResp },
    });

    await Sale.findByIdAndUpdate(payment.saleId, { $set: { status: 'cancelled' } });

    return ok(res, { message: 'Pago anulado correctamente', tbkResponse: tbkResp });
  } catch (error) {
    console.error('[Webpay refund]', error?.message ?? error);
    return serverError(res, error);
  }
}

module.exports = {
  initWebpay,
  returnWebpay,
  statusWebpay,
  getPaymentsBySale,
  refundWebpay,
};
