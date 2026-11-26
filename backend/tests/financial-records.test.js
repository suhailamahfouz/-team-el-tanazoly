const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const { request, app } = H;
const Package = require('../src/models/Package');
const Booking = require('../src/models/Booking');
const Payment = require('../src/models/Payment');
const Transfer = require('../src/models/Transfer');
const bookingService = require('../src/services/bookingService');

let token, staff, pkg;
const auth = () => ({ Authorization: `Bearer ${token}` });
const getRow = async bookingId => {
  const r = await request(app).get('/api/admin/transfers').query({ q: bookingId }).set(auth()).expect(200);
  return r.body;
};
const newOrder = async () => {
  const response = await H.createBooking(pkg.id).expect(201);
  return Booking.findOne({ bookingId: response.body.bookingId });
};

before(async () => {
  await H.reset({ replicaSet: true });
  token = await H.login('boss@t.co', 'bosspassword1');
  staff = await H.login('staff@t.co', 'staffpassword1');
  pkg = await Package.findOne({ price: 210 });
});
after(async () => H.close());

test('existing and future payments appear once with their order and private GridFS receipts', async () => {
  const order = await newOrder();
  const payment = await Payment.findOne({ booking: order._id });
  const legacy = await Transfer.create({ booking: order._id, bookingId: order.bookingId, amount: payment.amount,
    method: payment.method, receipt: payment.receipt, createdBy: 'customer' });
  const manual = await Transfer.create({ booking: order._id, bookingId: order.bookingId, amount: 50,
    method: 'instapay', reference: 'MANUAL-REF', createdBy: 'staff@t.co' });
  await request(app).get('/api/admin/transfers').expect(401);
  const methods = await request(app).get('/api/admin/transfers/methods').set({ Authorization: `Bearer ${staff}` }).expect(200);
  assert.ok(methods.body.some(m => m.key === 'instapay'));
  assert.ok(methods.body.some(m => m.key === 'vodafone_cash'));
  await request(app).get('/api/admin/transfers/methods').expect(401);
  const listed = await getRow(order.bookingId);
  assert.equal(listed.total, 2);
  const row = listed.items.find(t => t._id === `payment-${payment.id}`);
  assert.equal(row.bookingId, order.bookingId);
  assert.equal(row.booking.customerName, order.customerName);
  assert.equal(row.amount, 210); assert.equal(row.method, 'vodafone_cash');
  assert.equal(row.status, 'pending'); assert.ok(row.createdAt); assert.equal(row.receipt.storage, 'gridfs');
  assert.ok(listed.items.some(t => t._id === manual.id));
  assert.ok(!listed.items.some(t => t._id === legacy.id));
  const detail = await request(app).get(`/api/admin/bookings/${order.id}`).set(auth()).expect(200);
  assert.deepEqual(detail.body.transfers.map(t => t._id), [manual.id]);
  await request(app).get(`/api/admin/transfers/${row._id}/receipt`).expect(401);
  const receipt = await request(app).get(`/api/admin/transfers/${row._id}/receipt`).set(auth()).expect(200);
  assert.equal(receipt.headers['content-type'], 'image/png'); assert.equal(receipt.headers['cache-control'], 'private, no-store');
  assert.equal((await request(app).get('/api/admin/transfers').query({ q: 'MANUAL-REF' }).set(auth()).expect(200)).body.total, 1);
  assert.equal((await request(app).get('/api/admin/transfers').query({ q: order.bookingId, method: 'instapay' }).set(auth()).expect(200)).body.total, 1);
  assert.equal((await request(app).get('/api/admin/transfers').query({ q: order.bookingId, method: 'vodafone_cash', status: 'pending' }).set(auth()).expect(200)).body.total, 1);
  assert.equal((await request(app).get('/api/admin/transfers').query({ q: order.bookingId, status: 'confirmed' }).set(auth()).expect(200)).body.total, 0);
  const first = (await request(app).get('/api/admin/transfers').query({ q: order.bookingId, limit: 1, page: 1 }).set(auth()).expect(200)).body;
  const second = (await request(app).get('/api/admin/transfers').query({ q: order.bookingId, limit: 1, page: 2 }).set(auth()).expect(200)).body;
  assert.equal(first.total, 2); assert.equal(first.pages, 2); assert.notEqual(first.items[0]._id, second.items[0]._id);
  assert.equal(await Transfer.countDocuments({ booking: order._id }), 2, 'listing must not migrate or delete records');
  const future = await newOrder();
  assert.equal((await getRow(future.bookingId)).total, 1);
});

test('payment reviews update the order and cannot be repeated or raced', async () => {
  const approved = await newOrder();
  const payment = await Payment.findOne({ booking: approved._id });
  const endpoint = `/api/admin/transfers/payment-${payment.id}/review`;
  await request(app).post(endpoint).send({ status: 'confirmed' }).expect(401);
  const raced = await Promise.all(['confirmed', 'rejected'].map(status => request(app).post(endpoint).set(auth()).send({ status })));
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]);
  const savedPayment = await Payment.findById(payment.id);
  const savedOrder = await Booking.findById(approved.id);
  assert.equal(savedOrder.status, savedPayment.status === 'confirmed' ? 'payment_confirmed' : 'rejected');
  assert.ok(savedPayment.reviewedBy); assert.ok(savedPayment.reviewedAt);
  await request(app).post(endpoint).set(auth()).send({ status: 'confirmed' }).expect(409);
  assert.equal((await getRow(approved.bookingId)).items[0].status, savedPayment.status);

  const rejected = await newOrder();
  const rejectedPayment = await Payment.findOne({ booking: rejected._id });
  await request(app).post(`/api/admin/transfers/payment-${rejectedPayment.id}/review`).set(auth()).send({ status: 'rejected', note: 'إثبات غير واضح' }).expect(200);
  assert.equal((await Payment.findById(rejectedPayment.id)).status, 'rejected');
  assert.equal((await Booking.findById(rejected.id)).status, 'rejected');
  assert.equal((await Booking.findById(rejected.id)).rejectionReason, 'إثبات غير واضح');
  assert.equal((await request(app).get('/api/admin/transfers').query({ q: rejected.bookingId, status: 'rejected' }).set(auth()).expect(200)).body.total, 1);
});

test('review-first uploads and order-side review stay synchronized without duplicate payments', async () => {
  const order = await bookingService.createRequest({ packageId: pkg.id, renewalPhone: '0212345678', customerPhone: '01012345678' });
  await request(app).post(`/api/admin/bookings/${order.id}/approve`).set(auth()).send({}).expect(200);
  const submit = () => request(app).post('/api/orders/payment').field({ bookingId: order.bookingId, phone: '01012345678', paymentMethod: 'vodafone_cash' })
    .attach('receipt', H.PNG, { filename: 'receipt.png', contentType: 'image/png' });
  const submissions = await Promise.all([submit(), submit()]);
  assert.equal(submissions.filter(r => r.status === 200).length, 1);
  assert.ok(submissions.some(r => [404, 409].includes(r.status)));
  assert.equal(await Payment.countDocuments({ booking: order._id }), 1);
  assert.equal((await getRow(order.bookingId)).total, 1);
  await request(app).post(`/api/admin/bookings/${order.id}/confirm-payment`).set(auth()).send({}).expect(200);
  assert.equal((await Payment.findOne({ booking: order._id })).status, 'confirmed');
  assert.equal((await getRow(order.bookingId)).items[0].status, 'confirmed');
  await request(app).post(`/api/admin/bookings/${order.id}/activate`).set(auth()).send({}).expect(200);
  assert.equal((await Booking.findById(order.id)).status, 'activated');
});

test('legacy review links and manual transfer rejection update the related order', async () => {
  const legacyOrder = await newOrder();
  const payment = await Payment.findOne({ booking: legacyOrder._id });
  const mirror = await Transfer.create({ booking: legacyOrder._id, bookingId: legacyOrder.bookingId,
    amount: payment.amount, method: payment.method, receipt: payment.receipt, createdBy: 'customer' });
  await request(app).post(`/api/admin/transfers/${mirror.id}/review`).set(auth()).send({ status: 'confirmed' }).expect(200);
  assert.equal((await Booking.findById(legacyOrder.id)).status, 'payment_confirmed');
  assert.equal((await Payment.findById(payment.id)).status, 'confirmed');
  assert.equal((await getRow(legacyOrder.bookingId)).total, 1);
  assert.equal((await getRow(legacyOrder.bookingId)).items[0].status, 'confirmed');

  const manualOrder = await newOrder();
  const transfer = await Transfer.create({ booking: manualOrder._id, bookingId: manualOrder.bookingId,
    amount: 22, method: 'other', createdBy: 'staff@t.co' });
  await request(app).post(`/api/admin/transfers/${transfer.id}/review`).set(auth()).send({ status: 'rejected' }).expect(200);
  assert.equal((await Transfer.findById(transfer.id)).status, 'rejected');
  assert.equal((await Booking.findById(manualOrder.id)).status, 'rejected');
  assert.equal((await Payment.findOne({ booking: manualOrder.id })).status, 'rejected');

  const orderRejected = await newOrder();
  await request(app).post(`/api/admin/bookings/${orderRejected.id}/reject`).set(auth()).send({ reason: 'إثبات غير واضح' }).expect(200);
  assert.equal((await getRow(orderRejected.bookingId)).items[0].status, 'rejected');
});

test('a failed payment update rolls back the order review on a replica set', async () => {
  const order = await newOrder();
  const payment = await Payment.findOne({ booking: order._id });
  const original = Payment.updateOne;
  try {
    Payment.updateOne = async () => { throw new Error('simulated payment write failure'); };
    await request(app).post(`/api/admin/transfers/payment-${payment.id}/review`).set(auth()).send({ status: 'confirmed' }).expect(500);
  } finally { Payment.updateOne = original; }
  assert.equal((await Booking.findById(order.id)).status, 'payment_review');
  assert.equal((await Payment.findById(payment.id)).status, 'pending');
  await request(app).post(`/api/admin/transfers/payment-${payment.id}/review`).set(auth()).send({ status: 'confirmed' }).expect(200);
  assert.equal((await Booking.findById(order.id)).status, 'payment_confirmed');
  assert.equal((await Payment.findById(payment.id)).status, 'confirmed');

  const manualOrder = await newOrder();
  const manualPayment = await Payment.findOne({ booking: manualOrder._id });
  const transfer = await Transfer.create({ booking: manualOrder._id, bookingId: manualOrder.bookingId,
    amount: 20, method: 'other', createdBy: 'staff@t.co' });
  try {
    Payment.updateOne = async () => { throw new Error('simulated payment write failure'); };
    await request(app).post(`/api/admin/transfers/${transfer.id}/review`).set(auth()).send({ status: 'rejected' }).expect(500);
  } finally { Payment.updateOne = original; }
  assert.equal((await Transfer.findById(transfer.id)).status, 'pending');
  assert.equal((await Booking.findById(manualOrder.id)).status, 'payment_review');
  assert.equal((await Payment.findById(manualPayment.id)).status, 'pending');
});
