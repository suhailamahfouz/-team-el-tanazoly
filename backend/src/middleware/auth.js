const jwt = require('jsonwebtoken');
const cfg = require('../config/env');
const Admin = require('../models/Admin');
const { asyncH, httpError } = require('../utils/helpers');

exports.signToken = admin => jwt.sign({ sub: String(admin._id), role: admin.role }, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn });

exports.requireAuth = asyncH(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw httpError(401, 'يجب تسجيل الدخول');
  let payload;
  try { payload = jwt.verify(h.slice(7), cfg.jwtSecret); } catch { throw httpError(401, 'الجلسة منتهية، سجّل الدخول مرة أخرى'); }
  if (payload.type === 'customer') throw httpError(403, 'ليس لديك صلاحية الإدارة');
  const admin = await Admin.findById(payload.sub);
  if (!admin || !admin.isActive) throw httpError(401, 'الحساب غير مفعّل');
  req.admin = admin; // role always comes from the DB, never from the token alone
  next();
});

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.admin?.role) ? next() : next(httpError(403, 'ليس لديك صلاحية لهذا الإجراء'));
