/**
 * Servicio Cloudinary — wrapper sobre el SDK con la configuración de VAYO.
 * Cualquier subida/borrado de imágenes de la app pasa por aquí.
 */
const cloudinary = require('../config/cloudinary');

/**
 * Sube un Buffer a Cloudinary.
 * @param   {Buffer} buffer  - bytes de la imagen (multer memoryStorage)
 * @param   {string} folder  - folder de destino, ej. "vayo/products"
 * @returns {Promise<{ url: string, publicId: string }>}
 */
function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'image',
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      )
      .end(buffer);
  });
}

/**
 * Borra un asset de Cloudinary por su public_id.
 * No falla si el asset no existe — solo loguea.
 * @param   {string} publicId
 * @returns {Promise<void>}
 */
async function deleteAsset(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn('[cloudinary] No se pudo borrar asset', publicId, err.message);
  }
}

module.exports = { uploadBuffer, deleteAsset };
