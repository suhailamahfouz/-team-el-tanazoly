const Payment = require('../models/Payment');
const Transfer = require('../models/Transfer');
const Booking = require('../models/Booking');
const { escapeRegex, paginate } = require('../utils/helpers');

// Older customer checkouts wrote the same receipt to both collections. Only
// suppress a transfer when its customer origin and payment details match.
const matchingPayments = {
  from: Payment.collection.name,
  let: { booking: '$booking', amount: '$amount', method: '$method', file: { $ifNull: ['$receipt.file', null] }, origin: '$createdBy' },
  pipeline: [{ $match: { $expr: { $and: [
    { $eq: ['$$origin', 'customer'] }, { $eq: ['$booking', '$$booking'] },
    { $eq: ['$amount', '$$amount'] }, { $eq: ['$method', '$$method'] },
    { $eq: [{ $ifNull: ['$receipt.file', null] }, '$$file'] },
  ] } } }, { $limit: 1 }],
  as: 'matchingPayments',
};

exports.list = async query => {
  const filter = {};
  if (query.status) filter.status = String(query.status);
  if (query.method) filter.method = String(query.method);
  if (query.q) {
    const rx = new RegExp(escapeRegex(String(query.q).slice(0, 60)), 'i');
    filter.$or = [{ bookingId: rx }, { reference: rx }, { method: rx }];
  }
  const { page, limit, skip } = paginate(query);
  const [result] = await Transfer.aggregate([
    { $lookup: matchingPayments },
    { $match: { 'matchingPayments.0': { $exists: false } } },
    { $project: { matchingPayments: 0 } },
    { $unionWith: { coll: Payment.collection.name, pipeline: [
      { $set: { _id: { $concat: ['payment-', { $toString: '$_id' }] }, reference: '', createdBy: 'customer' } },
    ] } },
    { $lookup: { from: Booking.collection.name, localField: 'booking', foreignField: '_id', pipeline: [{ $project: { customerName: 1, bookingId: 1 } }], as: 'bookingData' } },
    { $set: {
      bookingId: { $ifNull: ['$bookingId', { $arrayElemAt: ['$bookingData.bookingId', 0] }] },
      booking: { $ifNull: [{ $arrayElemAt: ['$bookingData', 0] }, '$booking'] },
    } },
    { $project: { bookingData: 0 } },
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } },
  ]);
  const total = result.count[0]?.total || 0;
  return { items: result.items, total, page, pages: Math.ceil(total / limit) };
};

exports.isMirror = (transfer, payment) => !!payment && transfer.createdBy === 'customer'
  && String(transfer.booking) === String(payment.booking) && transfer.amount === payment.amount
  && transfer.method === payment.method && (payment.receipt?.file || null) === (transfer.receipt?.file || null);

exports.matchingPayment = async transfer => {
  if (transfer.createdBy !== 'customer') return null;
  const payment = await Payment.findOne({ booking: transfer.booking, amount: transfer.amount, method: transfer.method });
  return exports.isMirror(transfer, payment) ? payment : null;
};
