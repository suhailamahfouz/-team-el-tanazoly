const { Schema, model } = require('mongoose');
const CATEGORIES = ['internet', 'minutes_internet', 'special', 'flex', 'lines', 'service'];
const schema = new Schema({
  network: { type: Schema.Types.ObjectId, ref: 'Network', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  category: { type: String, enum: CATEGORIES, required: true, index: true },
  lineType: { type: String, enum: ['mobile', 'landline'], default: 'mobile' },
  internetQuota: { type: String, default: '', trim: true },
  minutes: { type: String, default: '', trim: true },
  validity: { type: String, default: '', trim: true },
  firstTimeFee: { type: String, default: '', trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 1000 },
  // price === null means "not confirmed by the owner yet": the package is listed but cannot be booked.
  price: { type: Number, default: null, min: 0 },
  priceNote: { type: String, default: '' },
  extraDetails: [{ _id: false, label: String, value: String, note: String }],
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });
schema.virtual('isBookable').get(function () { return this.isAvailable; });
schema.index({ name: 'text' });
module.exports = model('Package', schema);
module.exports.CATEGORIES = CATEGORIES;
