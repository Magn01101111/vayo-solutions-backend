import express from 'express';
import upload from '../middlewares/upload.middleware.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

router.post('/', upload.single('image'), async (req, res) => {
    try {
        const file = req.file;

        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true,
                    folder: 'productos',
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(file.buffer);
        });

        res.json({
            public_id: result.public_id,
            url: result.secure_url,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al subir imagen' });
    }
});

export default router;