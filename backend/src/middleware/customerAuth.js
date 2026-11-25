const jwt = require('jsonwebtoken');
const cfg = require('../config/env');
const UserAccount = require('../models/UserAccount');
const { asyncH, httpError } = require('../utils/helpers');

async function authenticate(header) {
  if (!header?.startsWith('Bearer ')) throw httpError(401, 'يجب تسجيل الدخول');
  let payload;
  try { payload = jwt.verify(header.slice(7), cfg.jwtSecret, { audience: 'customer' }); }
  catch { throw httpError(401, 'الجلسة منتهية، سجّل الدخول مرة أخرى'); }
  if (payload.type !== 'customer') throw httpError(401, 'الجلسة غير صالحة');
  const account = await UserAccount.findById(payload.sub);
  if (!account || !account.isActive) throw httpError(401, 'الحساب غير مفعّل');
  return account;
}
exports.required = asyncH(async (req, res, next) => { req.account = await authenticate(req.headers.authorization); next(); });
exports.optional = asyncH(async (req, res, next) => { if (req.headers.authorization) req.account = await authenticate(req.headers.authorization); next(); });
