process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const cfg = require('../src/config/env');
const app = require('../src/app');
const db = require('../src/config/db');
const seed = require('../seed/seed');
const Admin = require('../src/models/Admin');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
exports.PNG = PNG;
exports.app = app; exports.cfg = cfg; exports.request = request;

exports.reset = async () => {
  if (mongoose.connection.readyState === 0) await db.connect('mongodb://127.0.0.1:27017/tt-test');
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes?.();
  // seed() disconnects at the end; run its inner logic by reconnecting afterwards
  await seed();
  await Admin.create([
    { name: 'Boss', email: 'boss@t.co', passwordHash: await bcrypt.hash('bosspassword1', 4), role: 'admin' },
    { name: 'Staff', email: 'staff@t.co', passwordHash: await bcrypt.hash('staffpassword1', 4), role: 'staff' },
  ]);
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
};
exports.login = async (email, password) => (await request(app).post('/api/admin/auth/login').send({ email, password })).body.token;
exports.bookingFields = (pkgId, over = {}) => ({ packageId: pkgId, customerName: 'سارة أحمد', customerPhone: '01012345678', renewalPhone: '01112345678', paymentMethod: 'vodafone_cash', ...over });
exports.createBooking = (pkgId, over = {}, withReceipt = true) => {
  const r = request(app).post('/api/bookings');
  for (const [k, v] of Object.entries(exports.bookingFields(pkgId, over))) r.field(k, v);
  return withReceipt ? r.attach('receipt', PNG, { filename: 'r.png', contentType: 'image/png' }) : r;
};
