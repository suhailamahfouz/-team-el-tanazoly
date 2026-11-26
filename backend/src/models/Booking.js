const { Schema, model } = require('mongoose');
const STATUSES = ['pending', 'awaiting_payment', 'payment_review', 'payment_confirmed', 'processing', 'activated', 'rejected', 'cancelled'];
const schema = new Schema({
  bookingId: { type: String, required: true, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  account: { type: Schema.Types.ObjectId, ref: 'UserAccount', index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true, index: true },
  renewalPhone: { type: String, required: true },
  network: { type: Schema.Types.ObjectId, ref: 'Network', required: true },
  networkName: String,
  package: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
  // Snapshot at booking time: later price/name edits must not alter existing orders.
  packageSnapshot: { name: String, category: String, internetQuota: String, minutes: String, validity: String, firstTimeFee: String, priceNote: String },
  price: { type: Number, default: null, min: 0 },
  paymentMethod: { type: String, default: '' },
  workflow: { type: String, enum: ['legacy', 'review_first', 'payment_first'], default: 'legacy' },
  payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
  status: { type: String, enum: STATUSES, default: 'pending', index: true },
  statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: String, note: String }],
  auditTrail: [{
    _id: false, at: { type: Date, default: Date.now }, by: String,
    action: { type: String, enum: ['updated', 'transfer_added', 'transfer_reviewed'] },
    changes: [{ _id: false, field: String, before: Schema.Types.Mixed, after: Schema.Types.Mixed }],
  }],
  rejectionReason: String,
  adminNotes: [{ text: String, by: String, at: { type: Date, default: Date.now } }],
  activatedAt: Date,
}, { timestamps: true });
schema.index({ createdAt: -1 });
module.exports = model('Booking', schema);
module.exports.STATUSES = STATUSES;
