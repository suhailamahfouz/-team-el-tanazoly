process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-use-production';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const sharp = require('sharp');
const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');
const cfg = require('../src/config/env');
const app = require('../src/app');
const db = require('../src/config/db');
const seed = require('../seed/seed');
const Admin = require('../src/models/Admin');
const Settings = require('../src/models/WebsiteSettings');

let mongod;
exports.PNG = null;
exports.app = app; exports.cfg = cfg; exports.request = request;

exports.reset = async ({ replicaSet = false } = {}) => {
  mongod = replicaSet ? await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } })
    : await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await db.connect(mongod.getUri('tt_api_test'));
  exports.PNG = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await mongoose.syncIndexes?.();
  // seed() disconnects at the end; run its inner logic by reconnecting afterwards
  await seed();
  await Settings.updateOne({ key: 'main', 'paymentMethods.key': 'vodafone_cash' }, { $set: { 'paymentMethods.$.accountNumber': '000000' } });
  await Admin.create([
    { name: 'Boss', email: 'boss@t.co', passwordHash: await bcrypt.hash('bosspassword1', 4), role: 'admin' },
    { name: 'Staff', email: 'staff@t.co', passwordHash: await bcrypt.hash('staffpassword1', 4), role: 'staff' },
  ]);
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
};
exports.close = async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); };
exports.login = async (email, password) => (await request(app).post('/api/admin/auth/login').send({ email, password })).body.token;
exports.bookingFields = (pkgId, over = {}) => ({ packageId: pkgId, customerName: 'سارة أحمد', customerPhone: '01012345678', renewalPhone: '01112345678', paymentMethod: 'vodafone_cash', quotedPrice: '210', ...over });
exports.createBooking = (pkgId, over = {}, withReceipt = true) => {
  const r = request(app).post('/api/bookings');
  for (const [k, v] of Object.entries(exports.bookingFields(pkgId, over))) r.field(k, v);
  return withReceipt ? r.attach('receipt', exports.PNG, { filename: 'r.png', contentType: 'image/png' }) : r;
};
