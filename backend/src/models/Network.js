const { Schema, model } = require('mongoose');
module.exports = model('Network', new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  nameAr: { type: String, required: true, trim: true },
  nameEn: { type: String, required: true, trim: true },
  color: { type: String, default: '#7c3aed' },   // brand accent used by the UI
  logoUrl: { type: String, default: '' },          // supplied by the owner via admin upload
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true }));
