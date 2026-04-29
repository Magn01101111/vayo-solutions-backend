const { validationResult } = require('express-validator');
const { unprocessable } = require('../utils/response');

/**
 * handleValidation
 * Debe usarse DESPUÉS de los express-validator checks.
 * Si hay errores de validación, responde 422 con la lista de errores.
 */
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return unprocessable(
      res,
      result.array().map((e) => ({ field: e.path, msg: e.msg }))
    );
  }
  next();
}

module.exports = { handleValidation };
