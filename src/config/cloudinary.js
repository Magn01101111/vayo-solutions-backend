import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Solo esto, porque usa CLOUDINARY_URL automáticamente
cloudinary.config({
  secure: true,
});

export default cloudinary;