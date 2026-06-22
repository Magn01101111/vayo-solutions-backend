const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: { type: String, default: null, index: true },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['new_quote', 'low_stock', 'new_review', 'new_client'],
      required: true,
    },
    title: { type: String, required: true },
    body:  { type: String, default: '' },
    link:  { type: String, default: '' },
    read:  { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model('Notification', notificationSchema);
