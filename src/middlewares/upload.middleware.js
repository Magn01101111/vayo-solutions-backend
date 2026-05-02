const multer = require('multer');
const path = require('path');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

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

const storage = multer.memoryStorage();

/** Producto */
const uploadProductImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');

/** Logo */
const uploadCompanyLogo = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('logo');

module.exports = { uploadProductImage, uploadCompanyLogo };