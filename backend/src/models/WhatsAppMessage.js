const { Schema, model } = require('mongoose');
const STATUSES = ['prepared', 'opened', 'manually_confirmed', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'not_configured', 'received'];
module.exports = model('WhatsAppMessage', new Schema({
  booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
  bookingId: String,
  event: { type: String, index: true },
  direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
  category: { type: String, enum: ['transactional', 'marketing'], default: 'transactional' },
  to: String,
  recipientType: { type: String, enum: ['customer', 'renewal'], default: 'customer' },
  templateName: String,
  body: String,
  status: { type: String, enum: STATUSES, default: 'queued', index: true },
  openedAt: Date,
  manuallyConfirmedAt: Date,
  manuallyConfirmedBy: String,
  wamid: { type: String, index: true },
  attempts: { type: Number, default: 0 },
  error: { code: String, message: String },
  statusReason: String,
  // Unique only while a message is live. It is $unset on failed/skipped so an admin can legitimately resend.
  dedupeKey: { type: String, unique: true, sparse: true },
  timeline: [{ _id: false, status: String, at: Date }],
}, { timestamps: true }));
module.exports.STATUSES = STATUSES;
