const { Schema, model } = require('mongoose');
module.exports = model('WebsiteSettings', new Schema({
  key: { type: String, default: 'main', unique: true },
  businessName: { type: String, default: 'تيم النزلاوي 👑' },
  tagline: { type: String, default: 'عالم العروض .. باقتك في أمان وتفعيل في ثواني' },
  logoUrl: { type: String, default: '' },
  contact: { whatsapp: { type: String, default: '' }, phone: { type: String, default: '' }, email: { type: String, default: '' }, hours: { type: String, default: '' } },
  paymentMethods: [{
    _id: false, key: String, label: String, accountNumber: { type: String, default: '' }, accountName: { type: String, default: '' },
    instructions: { type: String, default: '' }, requiresReceipt: { type: Boolean, default: true }, enabled: { type: Boolean, default: true },
  }],
  faq: [{ _id: false, q: String, a: String }],
}, { timestamps: true }));
