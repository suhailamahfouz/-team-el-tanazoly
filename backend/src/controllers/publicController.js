const Network = require('../models/Network');
const Package = require('../models/Package');
const Booking = require('../models/Booking');
const Settings = require('../models/WebsiteSettings');
const bookingService = require('../services/bookingService');
const schemas = require('../validators/schemas');
const receiptStorage = require('../services/receiptStorage');
const { asyncH, httpError, escapeRegex, maskPhone } = require('../utils/helpers');
const Payment = require('../models/Payment');

exports.settings = asyncH(async (req, res) => {
  const s = (await Settings.findOne({ key: 'main' }).lean()) || {};
  res.json({
    businessName: s.businessName, tagline: s.tagline, logoUrl: s.logoUrl,
    contact: s.contact || { whatsapp: '', phone: '', email: '', hours: '' }, faq: s.faq || [],
    paymentMethods: [],
  });
});

exports.paymentMethods = asyncH(async (req, res) => {
  const settings = await Settings.findOne({ key: 'main' });
  res.json((settings?.paymentMethods || []).filter(m => m.enabled && m.accountNumber?.trim()).map(m => ({ key: m.key, label: m.label, accountNumber: m.accountNumber, accountName: m.accountName, instructions: m.instructions })));
});

exports.networks = asyncH(async (req, res) => res.json(await Network.find({ isActive: true }).sort({ sortOrder: 1 })));

exports.packages = asyncH(async (req, res) => {
  const { network, category, q, sort, featured } = req.query;
  const active = await Network.find({ isActive: true }).select('_id key');
  const filter = { network: { $in: active.map(n => n._id) } };
  if (network) { const n = active.find(x => x.key === network); filter.network = n ? n._id : null; }
  if (category) filter.category = String(category);
  if (featured === 'true') filter.isFeatured = true;
  if (q) filter.name = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i');
  const order = { price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 } }[sort] || { isFeatured: -1, sortOrder: 1, price: 1 };
  res.json(await Package.find(filter).populate('network', 'key nameAr nameEn color logoUrl').sort(order));
});

exports.packageById = asyncH(async (req, res) => {
  const p = await Package.findById(req.params.id).populate('network', 'key nameAr nameEn color logoUrl');
  if (!p) throw httpError(404, 'الباقة غير موجودة');
  res.json(p);
});

exports.createBooking = asyncH(async (req, res) => {
  const data = schemas.paidRenewalRequest.parse(req.body);
  const b = await bookingService.createWithReceipt(data, req.account, req.file);
  res.status(201).json({ bookingId: b.bookingId, status: b.status, price: b.price, packageName: b.packageSnapshot.name, networkName: b.networkName, linkedToAccount: !!b.account });
});

// Tracking needs BOTH booking id and the registered phone; a mismatch is indistinguishable from "not found".
exports.track = asyncH(async (req, res) => {
  const { bookingId, phone } = schemas.track.parse(req.body);
  const b = await Booking.findOne({ bookingId, customerPhone: phone });
  if (!b) throw httpError(404, 'لم نجد طلب بهذه البيانات');
  let paymentMethods = [];
  if (b.workflow === 'review_first' && b.status === 'awaiting_payment') {
    const settings = await Settings.findOne({ key: 'main' });
    paymentMethods = (settings?.paymentMethods || []).filter(m => m.enabled && m.accountNumber);
  }
  res.json({
    bookingId: b.bookingId, status: b.status, networkName: b.networkName, packageName: b.packageSnapshot.name, price: b.price,
    renewalPhone: maskPhone(b.renewalPhone), createdAt: b.createdAt, firstTimeFee: b.packageSnapshot.firstTimeFee,
    priceNote: (b.packageSnapshot.priceNote || '').replaceAll('سعر التفعيل غير مذكور؛ السعر المعروض هو سعر الباقة بعد الخصم.', '').trim(),
    rejectionReason: b.status === 'rejected' ? b.rejectionReason : undefined,
    history: b.statusHistory.map(h => ({ status: h.status, at: h.at })), paymentMethods,
  });
});

exports.submitPayment = asyncH(async (req, res) => {
  const data = schemas.submitPayment.parse(req.body);
  const b = await Booking.findOne({ bookingId: data.bookingId, customerPhone: data.phone, workflow: 'review_first', status: 'awaiting_payment' });
  if (!b) throw httpError(404, 'الطلب غير موجود أو غير متاح للدفع');
  const settings = await Settings.findOne({ key: 'main' });
  const method = settings?.paymentMethods?.find(m => m.key === data.paymentMethod && m.enabled && m.accountNumber);
  if (!method) throw httpError(400, 'طريقة الدفع غير متاحة');
  if (!req.file) throw httpError(400, 'إثبات الدفع مطلوب');
  const receipt = await receiptStorage.save(req.file);
  let payment;
  try {
    payment = await Payment.create({ booking: b._id, method: method.key, amount: b.price, receipt });
    const updated = await Booking.findOneAndUpdate(
      { _id: b._id, workflow: 'review_first', status: 'awaiting_payment' },
      { $set: { status: 'payment_review', payment: payment._id, paymentMethod: method.key }, $push: { statusHistory: { status: 'payment_review', by: 'customer', at: new Date(), note: 'تم رفع إثبات الدفع' } } }, { new: true });
    if (!updated) throw httpError(409, 'تغيرت حالة الطلب، يرجى تحديث الصفحة');
    await receiptStorage.markCommitted(receipt);
  } catch (err) {
    const stored = payment || await Payment.findOne({ booking: b._id });
    const current = await Booking.findById(b._id).select('payment status');
    if (stored && String(current?.payment) === String(stored._id) && stored.receipt?.file === receipt.file) { await receiptStorage.markCommitted(receipt); return res.json({ status: current.status }); }
    if (stored?.receipt?.storage === 'gridfs' && stored.receipt.file === receipt.file) await Payment.deleteOne({ _id: stored._id, booking: b._id });
    await receiptStorage.deleteIfUnreferenced(receipt);
    if (err.code === 11000) throw httpError(409, 'تم رفع إثبات الدفع بالفعل');
    throw err;
  }
  res.json({ status: 'payment_review' });
});
