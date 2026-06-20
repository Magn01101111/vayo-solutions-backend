const { ok, fail, serverError } = require('../utils/response');

// Contrato GCR (Python/FastAPI):
//   POST ${GCR_ML_URL}/detect
//   Body: { "image": "<base64_string>" }
//   Response: DetectionResult { detections[], source, modelVersion }
//   DetectionResult se define en §9 del Plan Maestro VAYO Mobile.

async function detect(req, res) {
  const gcrUrl = process.env.GCR_ML_URL;
  if (!gcrUrl) {
    return fail(res, 'Servicio ML no disponible temporalmente', 503);
  }

  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return fail(res, 'Campo "image" requerido (base64 o data URL)', 400);
  }

  // Eliminar prefijo "data:image/...;base64," si viene como DataUrl
  const base64 = image.includes(',') ? image.split(',')[1] : image;

  try {
    const gcrRes = await fetch(`${gcrUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!gcrRes.ok) {
      const body = await gcrRes.text();
      return fail(res, `Error en el modelo CNN: ${body}`, 502);
    }

    const result = await gcrRes.json();
    return ok(res, result);
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return fail(res, 'El servicio de análisis tardó demasiado', 504);
    }
    return serverError(res, error);
  }
}

module.exports = { detect };
