/**
 * Helpers de respuesta HTTP estandarizados para toda la API.
 * Formato: { ok: boolean, data?: any, error?: string, errors?: array }
 */

const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ ok: true, data });

const created = (res, data) => ok(res, data, 201);

const fail = (res, error, statusCode = 400) =>
  res.status(statusCode).json({ ok: false, error });

const unauthorized = (res, msg = 'No autorizado') => fail(res, msg, 401);

const forbidden = (res, msg = 'Acceso denegado: permisos insuficientes') =>
  fail(res, msg, 403);

const notFound = (res, msg = 'Recurso no encontrado') => fail(res, msg, 404);

const conflict = (res, msg) => fail(res, msg, 409);

const unprocessable = (res, errors) =>
  res.status(422).json({ ok: false, errors });

const serverError = (res, error) =>
  res.status(500).json({
    ok: false,
    error: error?.message || 'Error interno del servidor',
  });

module.exports = {
  ok,
  created,
  fail,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  serverError,
};
