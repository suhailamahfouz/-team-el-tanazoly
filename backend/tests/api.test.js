const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const H = require('./helpers');
const { request, app } = H;
const Package = require('../src/models/Package');
const Booking = require('../src/models/Booking');
const Message = require('../src/models/WhatsAppMessage');
const Transfer = require('../src/models/Transfer');

let boss, staff, pkg;
const auth = t => ({ Authorization: `Bearer ${t}` });

before(async () => {
  await H.reset();
  boss = await H.login('boss@t.co', 'bosspassword1');
  staff = await H.login('staff@t.co', 'staffpassword1');
  pkg = await Package.findOne({ price: 210 });
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe('catalog', () => {
  test('seed contains the current prices and Etisalat Cancel details', async () => {
    const all = (await request(app).get('/api/packages')).body;
    assert.deepEqual(all.filter(p => p.price != null).map(p => p.price).sort((a, b) => a - b), [110, 210, 270, 310, 450]);
    const cancel = all.find(p => p.category === 'service');
    assert.equal(cancel.name, 'كانسلت اتصالات'); assert.equal(cancel.price, 450); assert.equal(cancel.isBookable, true);
    assert.equal(cancel.internetQuota, '40 جيجا');
    assert.match(cancel.priceNote, /بعدها 200 جنيه/);
  });
  test('filters by network, category, search, sort', async () => {
    assert.equal((await request(app).get('/api/packages?network=etisalat')).body.length, 1);
    assert.equal((await request(app).get('/api/packages?category=flex')).body.length, 3);
    assert.equal((await request(app).get('/api/packages?q=26,000')).body.length, 1);
    const sorted = (await request(app).get('/api/packages?network=vodafone&sort=price_desc')).body.map(p => p.price);
    assert.deepEqual(sorted, [...sorted].sort((a, b) => b - a));
  });
  test('regex injection in search is escaped', async () => {
    const r = await request(app).get('/api/packages?q=.*(');
    assert.equal(r.status, 200); assert.equal(r.body.length, 0);
  });
});

describe('booking creation', () => {
  test('creates booking with unique id, snapshot, payment_review when receipt attached', async () => {
    const r = await H.createBooking(pkg.id);
    assert.equal(r.status, 201); assert.match(r.body.bookingId, /^TT-[A-Z0-9]{7}$/); assert.equal(r.body.status, 'payment_review');
    const b = await Booking.findOne({ bookingId: r.body.bookingId });
    assert.equal(b.price, 210); assert.equal(b.packageSnapshot.name, '10,400 فليكس'); assert.equal(b.customerPhone, '01012345678');
    assert.equal(await Message.countDocuments({ bookingId: r.body.bookingId }), 0, 'booking creation must not send/log an automatic message');
    const transfer = await Transfer.findOne({ booking: b._id });
    assert.equal(transfer.amount, 210); assert.equal(transfer.method, 'vodafone_cash'); assert.equal(transfer.status, 'pending');
    const r2 = await H.createBooking(pkg.id);
    assert.notEqual(r2.body.bookingId, r.body.bookingId);
  });
  test('normalizes +20 phone format', async () => {
    const r = await H.createBooking(pkg.id, { customerPhone: '+201012345678' });
    assert.equal(r.status, 201);
    assert.equal((await Booking.findOne({ bookingId: r.body.bookingId })).customerPhone, '01012345678');
  });
  test('rejects invalid phone, missing receipt, unbookable package, fake image', async () => {
    assert.equal((await H.createBooking(pkg.id, { renewalPhone: '123' })).status, 400);
    assert.equal((await H.createBooking(pkg.id, {}, false)).status, 400);
    const cancel = await Package.findOne({ category: 'service' });
    await Package.updateOne({ _id: cancel._id }, { price: null });
    assert.equal((await H.createBooking(cancel.id)).status, 409);
    await Package.updateOne({ _id: cancel._id }, { price: 450 });
    const fake = await request(app).post('/api/bookings').field(H.bookingFields(pkg.id)).attach('receipt', Buffer.from('<?php evil ?>'), { filename: 'x.png', contentType: 'image/png' });
    assert.equal(fake.status, 400);
  });
  test('price edits do not change existing bookings (snapshot)', async () => {
    const r = await H.createBooking(pkg.id);
    await request(app).put(`/api/admin/packages/${pkg.id}`).set(auth(boss)).send({ price: 999 }).expect(200);
    assert.equal((await Booking.findOne({ bookingId: r.body.bookingId })).price, 210);
    await request(app).put(`/api/admin/packages/${pkg.id}`).set(auth(boss)).send({ price: 210 }).expect(200);
  });
});

describe('tracking privacy', () => {
  test('requires matching id + phone; reveals no other customer data', async () => {
    const r = await H.createBooking(pkg.id);
    const ok = await request(app).post('/api/orders/track').send({ bookingId: r.body.bookingId, phone: '01012345678' });
    assert.equal(ok.status, 200); assert.equal(ok.body.customerName, undefined); assert.match(ok.body.renewalPhone, /\*/);
    assert.equal((await request(app).post('/api/orders/track').send({ bookingId: r.body.bookingId, phone: '01099999999' })).status, 404);
  });
});

describe('admin authorization', () => {
  test('401 without token, 403 for staff on admin-only routes, receipts are not public', async () => {
    assert.equal((await request(app).get('/api/admin/bookings')).status, 401);
    assert.equal((await request(app).put(`/api/admin/packages/${pkg.id}`).set(auth(staff)).send({ price: 1 })).status, 403);
    assert.equal((await request(app).get('/api/admin/settings').set(auth(staff))).status, 403);
    assert.equal((await request(app).get('/api/admin/bookings').set(auth(staff))).status, 200);
    assert.equal((await request(app).get('/uploads/receipts/anything.png')).status, 404);
  });
  test('wrong password rejected; forged token rejected', async () => {
    assert.equal((await request(app).post('/api/admin/auth/login').send({ email: 'boss@t.co', password: 'nope' })).status, 401);
    assert.equal((await request(app).get('/api/admin/bookings').set(auth('abc.def.ghi'))).status, 401);
  });
  test('admin can view receipt of a booking', async () => {
    const r = await H.createBooking(pkg.id);
    const b = await Booking.findOne({ bookingId: r.body.bookingId });
    const rec = await request(app).get(`/api/admin/bookings/${b.id}/receipt`).set(auth(staff));
    assert.equal(rec.status, 200); assert.equal(rec.headers['content-type'], 'image/png');
  });
});

describe('admin order management and manual WhatsApp', () => {
  let booking;
  before(async () => {
    const response = await H.createBooking(pkg.id, { customerName: 'منى' });
    booking = await Booking.findOne({ bookingId: response.body.bookingId });
  });
  test('admin edits are audited and order status history remains intact', async () => {
    await request(app).put(`/api/admin/bookings/${booking.id}`).set(auth(staff)).send({ customerName: 'منى أحمد', price: 225, renewalPhone: '01112345678' }).expect(200);
    const updated = await Booking.findById(booking.id);
    assert.equal(updated.customerName, 'منى أحمد'); assert.equal(updated.price, 225);
    assert.equal(updated.auditTrail.at(-1).action, 'updated'); assert.equal(updated.auditTrail.at(-1).changes.length, 2);
    await request(app).post(`/api/admin/bookings/${booking.id}/confirm-payment`).set(auth(staff)).send({}).expect(200);
    await request(app).post(`/api/admin/bookings/${booking.id}/processing`).set(auth(staff)).send({}).expect(200);
    await request(app).post(`/api/admin/bookings/${booking.id}/activate`).set(auth(staff)).send({}).expect(200);
    assert.equal(await Message.countDocuments({ booking: booking._id }), 0, 'status changes must not send/log any automatic WhatsApp message');
    assert.equal((await Booking.findById(booking.id)).status, 'activated');
  });
  test('Click-to-Chat lifecycle never calls a sender and opening alone is not sent', async () => {
    const prepared = await request(app).post(`/api/admin/bookings/${booking.id}/whatsapp`).set(auth(staff)).send({
      recipientType: 'renewal', to: '01112345678', event: 'activated', body: 'تم التجديد للباقة.',
    }).expect(201);
    assert.equal(prepared.body.status, 'prepared'); assert.equal(prepared.body.to, '01112345678');
    const opened = await request(app).post(`/api/admin/whatsapp/messages/${prepared.body._id}/opened`).set(auth(staff)).send({}).expect(200);
    assert.equal(opened.body.status, 'opened'); assert.ok(opened.body.openedAt);
    assert.equal((await Message.findById(prepared.body._id)).manuallyConfirmedAt, undefined);
    await request(app).post(`/api/admin/whatsapp/messages/${prepared.body._id}/confirm`).set(auth(staff)).send({ manuallyConfirmed: true }).expect(200);
    const confirmed = await Message.findById(prepared.body._id);
    assert.equal(confirmed.status, 'manually_confirmed'); assert.equal(confirmed.manuallyConfirmedBy, 'staff@t.co'); assert.ok(confirmed.manuallyConfirmedAt);
    assert.equal((await request(app).get('/api/webhooks/whatsapp')).status, 404);
  });
});

describe('transfer management', () => {
  test('records transfer, receipt, manual review, and audit history', async () => {
    const response = await H.createBooking(pkg.id);
    const booking = await Booking.findOne({ bookingId: response.body.bookingId });
    const form = request(app).post('/api/admin/transfers').set(auth(staff))
      .field('bookingId', booking.id).field('amount', '210').field('method', 'instapay').field('reference', 'REF-123')
      .attach('receipt', H.PNG, { filename: 'transfer.png', contentType: 'image/png' });
    const created = await form.expect(201);
    assert.equal(created.body.status, 'pending'); assert.equal(created.body.amount, 210);
    await request(app).get(`/api/admin/transfers/${created.body._id}/receipt`).set(auth(staff)).expect(200);
    await request(app).post(`/api/admin/transfers/${created.body._id}/review`).set(auth(staff)).send({ status: 'confirmed' }).expect(200);
    assert.equal((await Booking.findById(booking.id)).status, 'payment_confirmed');
    assert.equal((await Booking.findById(booking.id)).auditTrail.length, 2);
    assert.equal((await request(app).get('/api/admin/transfers?q=REF-123').set(auth(staff))).body.total, 1);
  });
});

describe('package management', () => {
  test('CRUD + bulk price dry-run does not change anything until confirmed', async () => {
    const net = (await request(app).get('/api/networks')).body.find(n => n.key === 'orange');
    const c = await request(app).post('/api/admin/packages').set(auth(boss)).send({ network: net._id, name: 'باقة تجريبية', category: 'internet', price: 100 });
    assert.equal(c.status, 201);
    const dry = await request(app).post('/api/admin/packages/bulk-price').set(auth(boss)).send({ delta: -20, network: net._id });
    assert.equal(dry.body.dryRun, true); assert.equal(dry.body.changes[0].to, 80);
    assert.equal((await Package.findById(c.body._id)).price, 100);
    await request(app).post('/api/admin/packages/bulk-price').set(auth(boss)).send({ delta: -20, network: net._id, dryRun: false }).expect(200);
    assert.equal((await Package.findById(c.body._id)).price, 80);
    await request(app).delete(`/api/admin/packages/${c.body._id}`).set(auth(boss)).expect(200);
  });
  test('stats reflect activated revenue', async () => {
    const s = (await request(app).get('/api/admin/stats').set(auth(staff))).body;
    assert.equal(s.revenue.activated, 225); assert.ok(s.totals.all >= 5);
  });
});
