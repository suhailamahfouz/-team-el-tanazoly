const { Schema, model } = require('mongoose');
module.exports = model('Admin', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' }, // staff: bookings only
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true }));
