const { Types } = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Network = require('../models/Network');
const Package = require('../models/Package');
const Payment = require('../models/Payment');
const Transfer = require('../models/Transfer');
const Message = require('../models/WhatsAppMessage');
const Settings = require('../models/WebsiteSettings');
const bookingService = require('../services/bookingService');
const financialRecords = require('../services/financialRecords');
const stats = require('../services/statsService');
const S = require('../validators/schemas');
const { signToken } = require('../middleware/auth');
const { saveVerified } = require('../middleware/upload');
const receiptStorage = require('../services/receiptStorage');
const { asyncH, httpError, escapeRegex, paginate } = require('../utils/helpers');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // constant-time-ish login for unknown emails

// ---------- auth ----------
exports.login = asyncH(async (req, res) => {
  const { email, password } = S.login.parse(req.body);
  if (Buffer.byteLength(password, 'utf8') > 72) throw httpError(401, 'البريد أو كلمة المرور غير صحيحة');
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, admin?.passwordHash || DUMMY_HASH);
  if (!admin || !ok || !admin.isActive) throw httpError(401, 'البريد أو كلمة المرور غير صحيحة');
  admin.lastLoginAt = new Date(); await admin.save();
  res.json({ token: signToken(admin), admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
});
exports.me = (req, res) => res.json({ id: req.admin._id, name: req.admin.name, email: req.admin.email, role: req.admin.role });

// ---------- stats ----------
exports.stats = asyncH(async (req, res) => res.json(await stats.overview()));

// ---------- bookings ----------
exports.listBookings = asyncH(async (req, res) => {
  const { q, status, network, from, to } = req.query;
  const f = {};
  if (status) f.status = String(status);
  if (network) f.network = String(network);
  if (from || to) f.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(new Date(to).getTime() + 864e5 - 1) }) };
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i');
    f.$or = [{ customerName: rx }, { customerPhone: rx }, { renewalPhone: rx }, { bookingId: rx }];
  }
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([Booking.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), Booking.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
exports.getBooking = asyncH(async (req, res) => {
  const b = await Booking.findById(req.params.id).populate('payment');
  if (!b) throw httpError(404, 'الطلب غير موجود');
  const messages = await Message.find({ booking: b._id }).sort({ createdAt: -1 });
  const allTransfers = await Transfer.find({ booking: b._id }).sort({ createdAt: -1 });
  const transfers = allTransfers.filter(t => !financialRecords.isMirror(t, b.payment));
  const payment = b.payment?.toObject?.() || null;
  if (payment?.receipt) payment.receipt = { ...payment.receipt, url: `/api/admin/bookings/${b._id}/receipt` };
  for (const t of transfers) if (t.receipt?.file) t.receipt.url = `/api/admin/transfers/${t._id}/receipt`;
  res.json({ ...b.toObject(), payment, messages, transfers });
});
exports.updateBooking = asyncH(async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) throw httpError(404, 'الطلب غير موجود');
  const data = S.bookingUpdate.parse(req.body);
  const changes = [];
  const set = (path, value) => {
    const before = path === 'packageSnapshot.name' ? b.packageSnapshot?.name : b.get(path);
    if (String(before ?? '') === String(value ?? '')) return;
    changes.push({ field: path, before, after: value });
    if (path === 'packageSnapshot.name') b.packageSnapshot.name = value;
    else b.set(path, value);
  };
  for (const key of ['customerName', 'customerPhone', 'renewalPhone', 'price', 'paymentMethod', 'networkName']) if (data[key] !== undefined) set(key, data[key]);
  if (data.packageName !== undefined) set('packageSnapshot.name', data.packageName);
  if (data.rejectionReason !== undefined) set('rejectionReason', data.rejectionReason);
  if (!changes.length) return res.json(b);
  if (data.customerPhone && data.customerPhone !== b.customerPhone && await Customer.exists({ phone: data.customerPhone, _id: { $ne: b.customer } })) {
    throw httpError(409, 'رقم الهاتف مرتبط بحساب عميل آخر');
  }
  b.auditTrail.push({ action: 'updated', by: req.admin.email, at: new Date(), changes });
  await b.save();
  if (data.customerPhone !== undefined || data.customerName !== undefined) {
    const customer = await Customer.findById(b.customer);
    if (customer) { if (data.customerPhone !== undefined) customer.phone = data.customerPhone; if (data.customerName !== undefined) customer.name = data.customerName; await customer.save(); }
  }
  res.json(b);
});
async function streamReceipt(receipt, res) {
  const { stream, mime } = await receiptStorage.open(receipt);
  res.set({ 'Content-Type': mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  stream.on('error', () => { if (res.headersSent) res.destroy(); else res.status(500).json({ message: 'تعذر تحميل الإيصال' }); });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
exports.receipt = asyncH(async (req, res) => {
  const p = await Payment.findOne({ booking: req.params.id });
  if (!p?.receipt?.file) throw httpError(404, 'لا يوجد إيصال');
  await streamReceipt(p.receipt, res);
});
exports.transferReceipt = asyncH(async (req, res) => {
  const id = req.params.id;
  const paymentId = id.startsWith('payment-') ? id.slice(8) : null;
  if (!Types.ObjectId.isValid(paymentId || id)) throw httpError(404, 'لا يوجد إيصال للتحويل');
  const transfer = paymentId ? await Payment.findById(paymentId) : await Transfer.findById(id);
  if (!transfer?.receipt?.file) throw httpError(404, 'لا يوجد إيصال للتحويل');
  await streamReceipt(transfer.receipt, res);
});
const act = (to, withReason) => asyncH(async (req, res) => {
  const reason = withReason ? S.reject.parse(req.body).reason : undefined;
  const booking = await bookingService.changeStatus(req.params.id, to, { admin: req.admin, reason, note: req.body?.note });
  res.json({ booking, notification: null });
});
exports.review = act('payment_review');
exports.approve = act('awaiting_payment');
exports.confirmPayment = act('payment_confirmed');
exports.process = act('processing');
exports.activate = act('activated');
exports.reject = act('rejected', true);
exports.cancel = act('cancelled');
exports.addNote = asyncH(async (req, res) => {
  const { text } = S.note.parse(req.body);
  const at = new Date();
  const b = await Booking.findByIdAndUpdate(req.params.id, {
    $push: {
      adminNotes: { text, by: req.admin.email, at },
      auditTrail: { action: 'updated', by: req.admin.email, at, changes: [{ field: 'adminNote', before: null, after: text }] },
    },
  }, { new: true });
  if (!b) throw httpError(404, 'الطلب غير موجود');
  res.json(b);
});
exports.prepareWhatsAppMessage = asyncH(async (req, res) => {
  const data = S.whatsappOpen.parse({ ...req.body, bookingId: req.params.id });
  const booking = await Booking.findById(data.bookingId);
  if (!booking) throw httpError(404, 'الطلب غير موجود');
  if (data.event === 'activated' && booking.status !== 'activated') throw httpError(409, 'لا يمكن تجهيز رسالة تأكيد التجديد قبل تأكيد تنفيذه');
  if (data.to !== (data.recipientType === 'customer' ? booking.customerPhone : booking.renewalPhone)) throw httpError(400, 'رقم المستلم لا يطابق بيانات الطلب');
  const message = await Message.create({
    booking: booking._id, bookingId: booking.bookingId, event: data.event, direction: 'outbound',
    category: 'transactional', to: data.to, recipientType: data.recipientType, body: data.body,
    status: 'prepared', timeline: [{ status: 'prepared', at: new Date() }],
  });
  res.status(201).json(message);
});
exports.markWhatsAppOpened = asyncH(async (req, res) => {
  const message = await Message.findOneAndUpdate(
    { _id: req.params.id, direction: 'outbound', status: 'prepared' },
    { $set: { status: 'opened', openedAt: new Date() }, $push: { timeline: { status: 'opened', at: new Date() } } },
    { new: true },
  );
  if (!message) throw httpError(409, 'الرسالة غير موجودة أو تم فتحها مسبقاً');
  res.json(message);
});
exports.confirmWhatsAppSent = asyncH(async (req, res) => {
  S.whatsappConfirm.parse(req.body);
  const message = await Message.findOneAndUpdate(
    { _id: req.params.id, direction: 'outbound', status: 'opened' },
    { $set: { status: 'manually_confirmed', manuallyConfirmedAt: new Date(), manuallyConfirmedBy: req.admin.email }, $push: { timeline: { status: 'manually_confirmed', at: new Date() } } },
    { new: true },
  );
  if (!message) throw httpError(409, 'يجب فتح واتساب للرسالة قبل تأكيد الإرسال اليدوي');
  res.json(message);
});

// ---------- transfers ----------
exports.transferMethods = asyncH(async (req, res) => {
  const [settings, paymentMethods, transferMethods] = await Promise.all([
    Settings.findOne({ key: 'main' }).select('paymentMethods.key paymentMethods.label').lean(),
    Payment.distinct('method'), Transfer.distinct('method'),
  ]);
  const methods = new Map((settings?.paymentMethods || []).map(m => [m.key, m.label || m.key]));
  for (const key of [...paymentMethods, ...transferMethods]) if (key && !methods.has(key)) methods.set(key, key);
  if (!methods.has('other')) methods.set('other', 'وسيلة أخرى');
  res.json([...methods].map(([key, label]) => ({ key, label })));
});
exports.listTransfers = asyncH(async (req, res) => {
  res.json(await financialRecords.list(req.query));
});
exports.createTransfer = asyncH(async (req, res) => {
  const data = S.transferCreate.parse(req.body);
  const booking = await Booking.findById(data.bookingId);
  if (!booking) throw httpError(404, 'الطلب غير موجود');
  const receipt = req.file ? await receiptStorage.save(req.file) : null;
  const transferId = new Types.ObjectId();
  let transfer;
  try {
    transfer = await Transfer.create({
      _id: transferId, booking: booking._id, bookingId: booking.bookingId, amount: data.amount, method: data.method,
      reference: data.reference || '', note: data.note || '', receipt: receipt || undefined, createdBy: req.admin.email,
    });
  } catch (err) {
    // A committed transfer must retain its receipt even if acknowledgement was lost.
    const saved = await Transfer.findById(transferId);
    if (saved) transfer = saved;
    else { if (receipt) await receiptStorage.deleteIfUnreferenced(receipt); throw err; }
  }
  if (receipt) await receiptStorage.markCommitted(receipt);
  booking.auditTrail.push({ action: 'transfer_added', by: req.admin.email, at: new Date(), changes: [{ field: 'transfer', before: null, after: { id: transfer._id, amount: transfer.amount, method: transfer.method, reference: transfer.reference } }] });
  await booking.save();
  res.status(201).json(transfer);
});
exports.reviewTransfer = asyncH(async (req, res) => {
  const { status, note } = S.transferReview.parse(req.body);
  const id = req.params.id;
  const paymentId = id.startsWith('payment-') ? id.slice(8) : null;
  if (!Types.ObjectId.isValid(paymentId || id)) throw httpError(404, 'التحويل غير موجود');
  const existingTransfer = paymentId ? null : await Transfer.findById(id);
  const payment = paymentId ? await Payment.findById(paymentId) : existingTransfer && await financialRecords.matchingPayment(existingTransfer);
  if (payment) {
    if (payment.status !== 'pending') throw httpError(409, 'الدفعة تمت مراجعتها بالفعل');
    await bookingService.changeStatus(payment.booking, status === 'confirmed' ? 'payment_confirmed' : 'rejected', {
      admin: req.admin, reason: status === 'rejected' ? (note || 'تم رفض إثبات الدفع') : undefined, note,
      expectedFrom: ['pending', 'payment_review'],
    });
    const reviewed = await Payment.findById(payment._id);
    return res.json({ ...reviewed.toObject(), _id: `payment-${reviewed._id}` });
  }
  if (paymentId) throw httpError(404, 'الدفعة غير موجودة');
  const transfer = await bookingService.withTransaction(async session => {
    const reviewed = await Transfer.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status, note: note || '', reviewedBy: req.admin.email, reviewedAt: new Date() } },
      { new: true, session },
    );
    if (!reviewed) throw httpError(409, 'التحويل غير موجود أو تمت مراجعته بالفعل');
    const booking = await Booking.findById(reviewed.booking).session(session);
    if (booking) {
      booking.auditTrail.push({ action: 'transfer_reviewed', by: req.admin.email, at: new Date(), changes: [{ field: `transfer:${reviewed._id}.status`, before: 'pending', after: status }] });
      await booking.save({ session });
      if (['pending', 'payment_review'].includes(booking.status)) {
        await bookingService.changeStatus(booking._id, status === 'confirmed' ? 'payment_confirmed' : 'rejected', {
          admin: req.admin, session, expectedFrom: ['pending', 'payment_review'],
          reason: status === 'rejected' ? (note || 'تم رفض التحويل') : undefined,
          note: `تم تأكيد التحويل ${reviewed.reference || reviewed._id}`,
        });
      }
    }
    return reviewed;
  });
  res.json(transfer);
});

// ---------- packages ----------
exports.listPackages = asyncH(async (req, res) => res.json(await Package.find().populate('network', 'key nameAr color').sort({ network: 1, sortOrder: 1, price: 1 })));
exports.createPackage = asyncH(async (req, res) => {
  const d = S.packageCreate.parse(req.body);
  if (!(await Network.exists({ _id: d.network }))) throw httpError(400, 'الشبكة غير موجودة');
  res.status(201).json(await Package.create(d));
});
exports.updatePackage = asyncH(async (req, res) => {
  const p = await Package.findByIdAndUpdate(req.params.id, { $set: S.packageUpdate.parse(req.body) }, { new: true, runValidators: true });
  if (!p) throw httpError(404, 'الباقة غير موجودة');
  res.json(p);
});
exports.deletePackage = asyncH(async (req, res) => {
  const p = await Package.findByIdAndDelete(req.params.id); // past bookings keep their own snapshot
  if (!p) throw httpError(404, 'الباقة غير موجودة');
  res.json({ deleted: true });
});
// Explicit, previewable bulk change (e.g. the owner's "-20 EGP"): dryRun defaults to true so nothing changes silently.
exports.bulkPrice = asyncH(async (req, res) => {
  const { delta, network, packageIds, dryRun } = S.bulkPrice.parse(req.body);
  const f = { price: { $ne: null } };
  if (network) f.network = network;
  if (packageIds) f._id = { $in: packageIds };
  const pkgs = await Package.find(f);
  const changes = pkgs.map(p => ({ id: p._id, name: p.name, from: p.price, to: Math.max(0, p.price + delta) }));
  if (!dryRun) await Package.bulkWrite(changes.map(c => ({ updateOne: { filter: { _id: c.id }, update: { $set: { price: c.to } } } })));
  res.json({ dryRun, count: changes.length, changes });
});

// ---------- networks ----------
exports.listNetworks = asyncH(async (req, res) => res.json(await Network.find().sort({ sortOrder: 1 })));
exports.createNetwork = asyncH(async (req, res) => res.status(201).json(await Network.create(S.networkUpsert.parse(req.body))));
exports.updateNetwork = asyncH(async (req, res) => {
  const n = await Network.findByIdAndUpdate(req.params.id, { $set: S.networkUpsert.partial().parse(req.body) }, { new: true });
  if (!n) throw httpError(404, 'الشبكة غير موجودة');
  res.json(n);
});
exports.deleteNetwork = asyncH(async (req, res) => {
  if (await Package.exists({ network: req.params.id }) || await Booking.exists({ network: req.params.id })) throw httpError(409, 'لا يمكن حذف شبكة لها باقات أو طلبات، قم بإيقافها بدلاً من ذلك');
  await Network.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});
exports.uploadImage = asyncH(async (req, res) => {
  const f = saveVerified(req.file, { dir: 'public', allowPdf: false });
  if (!f) throw httpError(400, 'لم يتم اختيار ملف');
  res.status(201).json({ url: `/uploads/public/${f.file}` });
});

// ---------- customers ----------
exports.listCustomers = asyncH(async (req, res) => {
  const f = {};
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i'); f.$or = [{ name: rx }, { phone: rx }]; }
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([Customer.find(f).sort({ updatedAt: -1 }).skip(skip).limit(limit), Customer.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
exports.getCustomer = asyncH(async (req, res) => {
  const c = await Customer.findById(req.params.id);
  if (!c) throw httpError(404, 'العميل غير موجود');
  res.json({ customer: c, bookings: await Booking.find({ customer: c._id }).sort({ createdAt: -1 }) });
});

// ---------- WhatsApp Click-to-Chat audit log ----------
exports.waMessages = asyncH(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = String(req.query.status);
  if (req.query.event) f.event = String(req.query.event);
  if (req.query.q) f.$or = [{ bookingId: new RegExp(escapeRegex(String(req.query.q)), 'i') }, { to: new RegExp(escapeRegex(String(req.query.q)), 'i') }];
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([Message.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), Message.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// ---------- settings ----------
exports.getSettings = asyncH(async (req, res) => res.json(await Settings.findOne({ key: 'main' })));
exports.updateSettings = asyncH(async (req, res) => {
  const d = S.settingsUpdate.parse(req.body);
  const set = {};
  for (const [k, v] of Object.entries(d)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) set[`${k}.${k2}`] = v2; else set[k] = v;
  }
  res.json(await Settings.findOneAndUpdate({ key: 'main' }, { $set: set }, { new: true, upsert: true }));
});
