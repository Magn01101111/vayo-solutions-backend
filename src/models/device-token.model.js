const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token:    { type: String, required: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
  active:   { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
