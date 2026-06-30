const {
  WebpayPlus,
  Options,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
  Environment,
} = require('transbank-sdk');

/**
 * Construye la instancia de Transaction según el entorno configurado.
 * En producción lee TBK_COMMERCE_CODE y TBK_API_KEY del entorno.
 * En integración (sandbox) usa las constantes del propio SDK.
 */
function buildTransaction() {
  const isProd = process.env.TBK_ENV === 'production';

  const commerceCode = isProd
    ? process.env.TBK_COMMERCE_CODE
    : IntegrationCommerceCodes.WEBPAY_PLUS;

  const apiKey = isProd
    ? process.env.TBK_API_KEY
    : IntegrationApiKeys.WEBPAY;

  const env = isProd ? Environment.Production : Environment.Integration;

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, env));
}

/**
 * Crea una transacción en Webpay Plus.
 * Retorna { token, url } — el frontend redirige al usuario a `url` con `token_ws`.
 */
async function createTransaction({ buyOrder, sessionId, amount, returnUrl }) {
  const tx = buildTransaction();
  return tx.create(buyOrder, sessionId, amount, returnUrl);
}

/**
 * Confirma (commit) la transacción una vez que Webpay redirige al usuario de vuelta.
 * Retorna el objeto completo de Transbank con authorization_code, status, etc.
 */
async function commitTransaction(token) {
  const tx = buildTransaction();
  return tx.commit(token);
}

/**
 * Consulta el estado de una transacción por su token.
 */
async function statusTransaction(token) {
  const tx = buildTransaction();
  return tx.status(token);
}

/**
 * Anula o reembolsa una transacción ya autorizada.
 */
async function refundTransaction(token, amount) {
  const tx = buildTransaction();
  return tx.refund(token, amount);
}

module.exports = {
  createTransaction,
  commitTransaction,
  statusTransaction,
  refundTransaction,
};
