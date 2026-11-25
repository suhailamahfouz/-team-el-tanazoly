const { Schema, model } = require('mongoose');

module.exports = model('Transfer', new Schema({
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  bookingId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, required: true, trim: true, maxlength: 60 },
  reference: { type: String, default: '', trim: true, maxlength: 100 },
  receipt: { file: String, mime: String, size: Number, originalName: String },
  status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending', index: true },
  note: { type: String, default: '', maxlength: 500 },
  createdBy: { type: String, required: true },
  reviewedBy: String,
  reviewedAt: Date,
}, { timestamps: true }));
