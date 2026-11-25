const rateLimit = require('express-rate-limit');
const cfg = require('../config/env');
const make = (windowMs, max, message) => cfg.rateLimitDisabled ? (req, res, next) => next()
  : rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message } });
exports.apiLimiter = make(60_000, 240, 'طلبات كثيرة، حاول بعد قليل');
exports.loginLimiter = make(15 * 60_000, 10, 'محاولات دخول كثيرة، حاول بعد 15 دقيقة');
exports.bookingLimiter = make(60 * 60_000, 15, 'تم تجاوز الحد المسموح لطلبات الحجز، حاول لاحقاً');
exports.trackLimiter = make(15 * 60_000, 30, 'محاولات تتبع كثيرة، حاول لاحقاً');
