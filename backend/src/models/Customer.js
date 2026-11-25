const { Schema, model } = require('mongoose');
module.exports = model('Customer', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, index: true },
  bookingsCount: { type: Number, default: 0 },
}, { timestamps: true }));
