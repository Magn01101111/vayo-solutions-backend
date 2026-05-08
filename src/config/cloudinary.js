const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  secure: true, // usa CLOUDINARY_URL
});

module.exports = cloudinary;