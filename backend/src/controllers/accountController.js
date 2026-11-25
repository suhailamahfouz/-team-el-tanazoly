const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cfg = require('../config/env');
const Admin = require('../models/Admin');
const UserAccount = require('../models/UserAccount');
const { signToken } = require('../middleware/auth');
const { asyncH, httpError, normalizePhone } = require('../utils/helpers');
const schemas = require('../validators/schemas');
const Booking = require('../models/Booking');
const { paginate } = require('../utils/helpers');

const dummyHash = bcrypt.hashSync('not-a-real-password', 10);
const publicUser = u => ({ id: String(u._id), name: u.name, ...(u.phone ? { phone: u.phone } : { email: u.email }), role: 'customer' });
const customerToken = u => jwt.sign({ sub: String(u._id), type: 'customer' }, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn, audience: 'customer' });

exports.register = asyncH(async (req, res) => {
  const data = schemas.registerAccount.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  let user;
  try { user = await UserAccount.create({ name: data.name, email: `phone:${data.phone}`, phone: data.phone, passwordHash }); }
  catch (e) { if (e.code === 11000) throw httpError(409, 'رقم الموبايل مستخدم بالفعل'); throw e; }
  res.status(201).json({ token: customerToken(user), user: publicUser(user) });
});

exports.login = asyncH(async (req, res) => {
  const input = schemas.accountLogin.parse(req.body);
  const identifier = input.identifier || input.email;
  const phone = normalizePhone(identifier);
  const email = phone ? null : identifier.trim().toLowerCase();
  const password = input.password;
  if (Buffer.byteLength(password, 'utf8') > 72) throw httpError(401, 'بيانات الدخول غير صحيحة');
  if (email && !schemas.login.shape.email.safeParse(email).success) throw httpError(401, 'بيانات الدخول غير صحيحة');
  const admin = email ? await Admin.findOne({ email }).select('+passwordHash') : null;
  if (admin) {
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok || !admin.isActive) throw httpError(401, 'بيانات الدخول غير صحيحة');
    admin.lastLoginAt = new Date(); await admin.save();
    return res.json({ token: signToken(admin), user: { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role } });
  }
  const user = await UserAccount.findOne({ email: phone ? `phone:${phone}` : email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !ok || !user.isActive) throw httpError(401, 'بيانات الدخول غير صحيحة');
  res.json({ token: customerToken(user), user: publicUser(user) });
});

exports.me = asyncH(async (req, res) => {
  res.json({ user: publicUser(req.account) });
});

exports.orders = asyncH(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  if (!req.account.phone) return res.json({ items: [], total: 0, page, pages: 0 });
  const filter = { account: req.account._id, customerPhone: req.account.phone };
  const [items, total] = await Promise.all([
    Booking.find(filter).select('bookingId status networkName packageSnapshot.name price createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({ items: items.map(b => ({ bookingId: b.bookingId, status: b.status, networkName: b.networkName, packageName: b.packageSnapshot.name, price: b.price, createdAt: b.createdAt })), total, page, pages: Math.ceil(total / limit) });
});

exports.linkOrder = asyncH(async (req, res) => {
  const { bookingId, phone } = schemas.track.parse(req.body);
  if (!req.account.phone || phone !== req.account.phone) throw httpError(404, 'لم نجد طلبًا بهذه البيانات لحسابك');
  const b = await Booking.findOneAndUpdate(
    { bookingId, customerPhone: phone, $or: [{ account: { $exists: false } }, { account: null }, { account: req.account._id }] },
    { $set: { account: req.account._id } }, { new: true });
  if (!b) throw httpError(404, 'لم نجد طلبًا بهذه البيانات لحسابك');
  res.json({ linked: true });
});
