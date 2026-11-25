const { Schema, model } = require('mongoose');
module.exports = model('Payment', new Schema({
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  receipt: { file: String, mime: String, size: Number, originalName: String }, // private file, admin-only access
  status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  reviewedBy: String,
  reviewedAt: Date,
}, { timestamps: true }));
