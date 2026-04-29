const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Crea un storage de multer apuntando a uploads/<subfolder>/
 */
function buildStorage(subfolder) {
  const dest = path.join(
    process.cwd(),
    process.env.UPLOAD_PATH || 'uploads',
    subfolder
  );
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${ext}`);
    },
  });
}

function imageFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Formato no permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }
}

/** Sube una imagen de producto (campo: "image", máx 5 MB) */
const uploadProductImage = multer({
  storage: buildStorage('products'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');

/** Sube el logotipo de la empresa (campo: "logo", máx 2 MB) */
const uploadCompanyLogo = multer({
  storage: buildStorage('company'),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('logo');

module.exports = { uploadProductImage, uploadCompanyLogo };
