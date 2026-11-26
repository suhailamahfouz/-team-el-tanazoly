const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Package = require('../models/Package');
const Payment = require('../models/Payment');
const Settings = require('../models/WebsiteSettings');
const { generateBookingId, httpError } = require('../utils/helpers');
const mongoose = require('mongoose');
const { Types } = mongoose;
const receiptStorage = require('./receiptStorage');

// Allowed lifecycle transitions. Anything else is rejected with 409.
const ALLOWED = {
  pending: ['awaiting_payment', 'payment_review', 'payment_confirmed', 'rejected', 'cancelled'],
  awaiting_payment: ['rejected', 'cancelled'],
  payment_review: ['payment_confirmed', 'rejected', 'cancelled'],
  payment_confirmed: ['processing', 'activated', 'rejected', 'cancelled'],
  processing: ['activated', 'rejected'],
  activated: [], rejected: [], cancelled: [],
};
exports.ALLOWED = ALLOWED;
exports.createRequest = async (data, account) => {
  const pkg = await Package.findById(data.packageId).populate('network');
  if (!pkg || !pkg.network?.isActive) throw httpError(404, 'الباقة غير موجودة');
  if (!pkg.isAvailable) throw httpError(409, 'الباقة غير متاحة للطلب، تواصل معنا للاستفسار');
  const customer = await Customer.findOneAndUpdate(
    { phone: data.customerPhone }, { $setOnInsert: { name: 'عميل' }, $inc: { bookingsCount: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true });
  for (let i = 0; i < 5; i++) {
    try {
      return await Booking.create({
        bookingId: generateBookingId(), customer: customer._id, customerName: customer.name,
        ...(account?.phone && account.phone === data.customerPhone ? { account: account._id } : {}),
        customerPhone: data.customerPhone, renewalPhone: data.renewalPhone,
        network: pkg.network._id, networkName: pkg.network.nameAr, package: pkg._id,
        packageSnapshot: { name: pkg.name, category: pkg.category, internetQuota: pkg.internetQuota, minutes: pkg.minutes, validity: pkg.validity, firstTimeFee: pkg.firstTimeFee, priceNote: pkg.priceNote },
        price: pkg.price, workflow: 'review_first', status: 'pending',
        statusHistory: [{ status: 'pending', by: 'customer', at: new Date() }],
      });
    } catch (e) { if (e.code !== 11000 || e.keyPattern?.bookingId === undefined) throw e; }
  }
  throw httpError(500, 'تعذر إنشاء رقم الطلب، حاول مرة أخرى');
};

exports.createWithReceipt = async (data, account, file) => {
  const pkg = await Package.findById(data.packageId).populate('network');
  if (!pkg || !pkg.network?.isActive) throw httpError(404, 'الباقة غير موجودة');
  if (!pkg.isAvailable) throw httpError(409, 'الباقة غير متاحة حالياً');
  if (pkg.price == null) throw httpError(409, 'سعر الباقة لم يتحدد بعد، تواصل معنا قبل التحويل');
  if (pkg.price !== data.quotedPrice) throw httpError(409, 'سعر الباقة اتغير. ارجع للباقات وراجع السعر قبل التحويل');
  const settings = await Settings.findOne({ key: 'main' });
  const method = settings?.paymentMethods?.find(m => m.key === data.paymentMethod && m.enabled && m.accountNumber?.trim());
  if (!method) throw httpError(400, 'طريقة الدفع غير متاحة حالياً');
  if (!file) throw httpError(400, 'ارفع صورة إثبات التحويل');
  const receipt = await receiptStorage.save(file);
  const bookingObjectId = new Types.ObjectId();
  let customer, payment, booking;
  try {
    customer = await Customer.findOneAndUpdate(
      { phone: data.customerPhone }, { $setOnInsert: { name: 'عميل' }, $inc: { bookingsCount: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true });
    payment = await Payment.create({ booking: bookingObjectId, method: method.key, amount: pkg.price, receipt });
    for (let i = 0; i < 5 && !booking; i++) {
      try {
        booking = await Booking.create({
          _id: bookingObjectId, bookingId: generateBookingId(), customer: customer._id, customerName: customer.name,
          ...(account?.phone && account.phone === data.customerPhone ? { account: account._id } : {}),
          customerPhone: data.customerPhone, renewalPhone: data.renewalPhone,
          network: pkg.network._id, networkName: pkg.network.nameAr, package: pkg._id,
          packageSnapshot: { name: pkg.name, category: pkg.category, internetQuota: pkg.internetQuota, minutes: pkg.minutes, validity: pkg.validity, firstTimeFee: pkg.firstTimeFee, priceNote: pkg.priceNote },
          price: pkg.price, paymentMethod: method.key, payment: payment._id, workflow: 'payment_first', status: 'payment_review',
          statusHistory: [{ status: 'payment_review', by: 'customer', note: 'تم إرسال الطلب وإثبات التحويل', at: new Date() }],
        });
      } catch (e) { if (e.code !== 11000 || e.keyPattern?.bookingId === undefined) throw e; }
    }
    if (!booking) throw httpError(500, 'تعذر إنشاء رقم الطلب، حاول مرة أخرى');
    await receiptStorage.markCommitted(receipt);
    return booking;
  } catch (err) {
    // If an insert succeeded but its acknowledgement was lost, preserve the order and receipt.
    let saved;
    try { saved = await Booking.findById(bookingObjectId); } catch { throw err; }
    if (saved) { await receiptStorage.markCommitted(receipt); return saved; }
    const storedPayment = payment || await Payment.findOne({ booking: bookingObjectId });
    if (storedPayment?.receipt?.storage === 'gridfs' && storedPayment.receipt.file === receipt.file) await Payment.deleteOne({ _id: storedPayment._id, booking: bookingObjectId });
    await receiptStorage.deleteIfUnreferenced(receipt);
    if (customer) await Customer.updateOne({ _id: customer._id }, { $inc: { bookingsCount: -1 } });
    throw err;
  }
};
exports.create = async ({ data, receipt }) => {
  const pkg = await Package.findById(data.packageId).populate('network');
  if (!pkg || !pkg.network?.isActive) throw httpError(404, 'الباقة غير موجودة');
  if (!pkg.isAvailable) throw httpError(409, 'الباقة غير متاحة حالياً');
  if (pkg.price == null) throw httpError(409, 'سعر هذه الباقة لم يتم تأكيده بعد، تواصل معنا على الواتساب');

  const settings = await Settings.findOne({ key: 'main' });
  const method = settings?.paymentMethods?.find(m => m.key === data.paymentMethod && m.enabled);
  if (!method) throw httpError(400, 'طريقة الدفع غير متاحة');
  if (method.requiresReceipt && !receipt) throw httpError(400, 'صورة إيصال الدفع مطلوبة');

  const customer = await Customer.findOneAndUpdate(
    { phone: data.customerPhone },
    { $set: { name: data.customerName }, $inc: { bookingsCount: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true });

  let booking;
  for (let i = 0; i < 5 && !booking; i++) {
    const status = receipt ? 'payment_review' : 'pending';
    try {
      booking = await Booking.create({
        bookingId: generateBookingId(), customer: customer._id, customerName: data.customerName, customerPhone: data.customerPhone,
        renewalPhone: data.renewalPhone, network: pkg.network._id, networkName: pkg.network.nameAr, package: pkg._id,
        packageSnapshot: { name: pkg.name, category: pkg.category, internetQuota: pkg.internetQuota, minutes: pkg.minutes, validity: pkg.validity },
        price: pkg.price, paymentMethod: method.key, status,
        statusHistory: [{ status, by: 'customer', note: receipt ? 'تم رفع إيصال الدفع' : undefined }],
      });
    } catch (e) { if (e.code !== 11000 || e.keyPattern?.bookingId === undefined) throw e; }
  }
  if (!booking) throw httpError(500, 'تعذر إنشاء رقم الطلب، حاول مرة أخرى');

  const payment = await Payment.create({ booking: booking._id, method: method.key, amount: booking.price, receipt: receipt || undefined });
  booking.payment = payment._id; await booking.save();
  return booking;
};

async function updateStatus(id, to, { admin, reason, note, expectedFrom }, session) {
  const from = Object.keys(ALLOWED).filter(k => ALLOWED[k].includes(to) && (!expectedFrom || expectedFrom.includes(k)));
  const workflowGuard = to === 'awaiting_payment' ? { workflow: 'review_first', price: { $type: 'number', $gte: 0 } }
    : ['payment_review', 'payment_confirmed'].includes(to) ? { $or: [{ workflow: { $ne: 'review_first' } }, { status: 'payment_review' }] } : {};
  const set = { status: to };
  if (to === 'rejected') set.rejectionReason = reason;
  if (to === 'activated') set.activatedAt = new Date();
  const booking = await Booking.findOneAndUpdate(
    { _id: id, status: { $in: from }, ...workflowGuard }, // atomic guard: prevents double activation / invalid jumps
    { $set: set, $push: { statusHistory: { status: to, by: admin.email, note: reason || note, at: new Date() } } }, { new: true, session });
  if (!booking) {
    const existing = await Booking.findById(id).select('status workflow price').session(session);
    if (to === 'awaiting_payment' && existing?.workflow === 'review_first' && existing.status === 'pending' && existing.price == null) throw httpError(409, 'حددي سعر الطلب بعد مراجعة العرض قبل طلب الدفع');
    const exists = !!existing;
    throw httpError(exists ? 409 : 404, exists ? 'لا يمكن تنفيذ هذا الإجراء على حالة الطلب الحالية' : 'الطلب غير موجود');
  }
  if (to === 'payment_confirmed') await Payment.updateOne({ booking: booking._id }, { status: 'confirmed', reviewedBy: admin.email, reviewedAt: new Date() }, { session });
  if (to === 'rejected' || to === 'cancelled') await Payment.updateOne({ booking: booking._id, status: 'pending' }, { status: 'rejected', reviewedBy: admin.email, reviewedAt: new Date() }, { session });
  return booking;
};

exports.withTransaction = async fn => {
  // Atlas replica sets support transactions, keeping the order and payment
  // together even when a write fails. Retain standalone MongoDB compatibility.
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid') {
    return mongoose.connection.transaction(fn);
  }
  return fn(null);
};

exports.changeStatus = async (id, to, details) => {
  if (Object.hasOwn(details, 'session')) return updateStatus(id, to, details, details.session);
  if (['payment_confirmed', 'rejected', 'cancelled'].includes(to)) return exports.withTransaction(session => updateStatus(id, to, details, session));
  return updateStatus(id, to, details, null);
};
