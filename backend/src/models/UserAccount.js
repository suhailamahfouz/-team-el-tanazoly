const { Schema, model } = require('mongoose');

module.exports = model('UserAccount', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  // Existing accounts use an email; phone accounts use the unique key `phone:<normalized number>`.
  // Keeping the existing unique index preserves older accounts without a destructive index migration.
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, default: '' },
  passwordHash: { type: String, required: true, select: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true }));
