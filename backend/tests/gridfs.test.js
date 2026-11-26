// This suite starts its own local MongoDB and never reads MONGODB_URI from .env.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-use-production';
process.env.JWT_SECRET = 'isolated-test-secret-not-for-real-deployments';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-receipts-test-'));
process.env.UPLOAD_DIR = tempDir;
const mongoose = require('mongoose');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const Network = require('../src/models/Network');
const Package = require('../src/models/Package');
const Admin = require('../src/models/Admin');
const Settings = require('../src/models/WebsiteSettings');
const Booking = require('../src/models/Booking');
const Payment = require('../src/models/Payment');
const Transfer = require('../src/models/Transfer');
const storage = require('../src/services/receiptStorage');

let mongod, network, pkg, adminToken, staffToken, customerToken, png, jpeg, webp, booking, payment;
const auth = token => ({ Authorization: `Bearer ${token}` });
const fields = () => ({ packageId: String(pkg._id), renewalPhone: '01012345678', customerPhone: '01012345678', paymentMethod: 'wallet', quotedPrice: '210' });
const file = (buffer, mimetype, originalname = 'receipt') => ({ buffer, mimetype, originalname, size: buffer.length });
const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
const collect = async stream => { const pieces = []; for await (const part of stream) pieces.push(part); return Buffer.concat(pieces); };
const countFiles = () => mongoose.connection.db.collection('receipts.files').countDocuments();
const countMarkers = () => mongoose.connection.db.collection('receipt_uploads').countDocuments();

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongod.getUri('gridfs_test'));
  network = await Network.create({ key: 'test', nameAr: 'اختبار', nameEn: 'Test' });
  pkg = await Package.create({ network: network._id, name: 'اختبار', category: 'internet', price: 210 });
  await Settings.create({ key: 'main', paymentMethods: [{ key: 'wallet', label: 'Wallet', accountNumber: '00000', enabled: true }] });
  await Admin.create([
    { name: 'Admin', email: 'admin@example.invalid', passwordHash: await bcrypt.hash('test-password-123', 4), role: 'admin' },
    { name: 'Staff', email: 'staff@example.invalid', passwordHash: await bcrypt.hash('test-password-123', 4), role: 'staff' },
  ]);
  adminToken = (await request(app).post('/api/admin/auth/login').send({ email: 'admin@example.invalid', password: 'test-password-123' }).expect(200)).body.token;
  staffToken = (await request(app).post('/api/admin/auth/login').send({ email: 'staff@example.invalid', password: 'test-password-123' }).expect(200)).body.token;
  customerToken = (await request(app).post('/api/auth/register').send({ name: 'Customer', phone: '01012345678', password: 'test-password-123' }).expect(201)).body.token;
  const svg = Buffer.from('<svg width="1200" height="800"><rect width="1200" height="800" fill="white"/><text x="80" y="240" font-size="75" fill="black">TRANSFER 123456 210.00 EGP</text><text x="80" y="360" font-size="48" fill="black">REFERENCE 9876543210</text></svg>');
  png = await sharp(svg).png().toBuffer();
  jpeg = await sharp(svg).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toBuffer();
  webp = await sharp(svg).webp({ lossless: true }).toBuffer();
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  const legacy = path.join(tempDir, 'receipts', 'legacy.png');
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  const legacyDir = path.join(tempDir, 'receipts');
  if (fs.existsSync(legacyDir)) fs.rmdirSync(legacyDir);
  fs.rmdirSync(tempDir);
});

test('receipt upload persists in GridFS and only authorized staff can retrieve it', async () => {
  const result = await request(app).post('/api/bookings').field(fields()).attach('receipt', jpeg, { filename: 'transfer.jpg', contentType: 'image/jpeg' }).expect(201);
  assert.equal(result.body.status, 'payment_review');
  booking = await Booking.findOne({ bookingId: result.body.bookingId });
  payment = await Payment.findOne({ booking: booking._id });
  assert.equal(payment.receipt.storage, 'gridfs');
  assert.match(payment.receipt.file, /^[a-f0-9]{24}$/);
  const id = new mongoose.Types.ObjectId(payment.receipt.file);
  assert.ok(await mongoose.connection.db.collection('receipts.files').findOne({ _id: id }));
  assert.equal(await countMarkers(), 0);
  assert.equal(fs.existsSync(path.join(tempDir, 'receipts')), false);
  await request(app).get(`/api/admin/bookings/${booking._id}/receipt`).expect(401);
  await request(app).get(`/api/admin/bookings/${booking._id}/receipt`).set(auth(customerToken)).expect(403);
  await request(app).get(`/uploads/receipts/${payment.receipt.file}`).expect(404);
  const image = await request(app).get(`/api/admin/bookings/${booking._id}/receipt`).set(auth(staffToken)).expect(200);
  assert.match(image.headers['content-type'], /^image\/jpeg/);
  assert.match(image.headers['cache-control'], /no-store/);
  assert.equal(image.headers['x-content-type-options'], 'nosniff');
  assert.equal((await sharp(image.body).metadata()).width, 1200);
  assert.equal((await sharp(image.body).metadata()).height, 800);
  assert.ok(image.body.length <= jpeg.length);
  const originalPixels = await sharp(jpeg).raw().toBuffer();
  const savedPixels = await sharp(image.body).raw().toBuffer();
  let difference = 0; for (let i = 0; i < originalPixels.length; i++) difference += Math.abs(originalPixels[i] - savedPixels[i]);
  assert.ok(difference / originalPixels.length < 3, 'text and payment details should remain legible');
  await request(app).post(`/api/admin/bookings/${booking._id}/activate`).set(auth(adminToken)).send({}).expect(409);
  await mongoose.disconnect(); await mongoose.connect(mongod.getUri('gridfs_test'));
  const afterReconnect = await request(app).get(`/api/admin/bookings/${booking._id}/receipt`).set(auth(adminToken)).expect(200);
  assert.deepEqual(afterReconnect.body, image.body);
  const childCode = `const m=require('mongoose'),s=require('./src/services/receiptStorage'),c=require('crypto'); (async()=>{await m.connect(process.env.MONGODB_URI);const r=await s.open({storage:'gridfs',file:process.env.TEST_RECEIPT_ID});const h=c.createHash('sha256');for await(const chunk of r.stream)h.update(chunk);console.log(h.digest('hex'));await m.disconnect()})().catch(()=>process.exit(1))`;
  const childHash = execFileSync(process.execPath, ['-e', childCode], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, MONGODB_URI: mongod.getUri('gridfs_test'), TEST_RECEIPT_ID: payment.receipt.file }, encoding: 'utf8' }).trim();
  assert.equal(childHash, crypto.createHash('sha256').update(image.body).digest('hex'));
});

test('supports PNG, WebP and PDF and rejects invalid or oversized files', async () => {
  for (const [buffer, mime] of [[png, 'image/png'], [webp, 'image/webp'], [pdf, 'application/pdf']]) {
    const receipt = await storage.save(file(buffer, mime));
    const opened = await storage.open(receipt); const data = await collect(opened.stream);
    assert.equal(opened.mime, mime); assert.ok(data.length <= buffer.length);
    if (mime !== 'application/pdf') {
      const before = await sharp(buffer).raw().toBuffer(); const after = await sharp(data).raw().toBuffer();
      assert.deepEqual(after, before, `${mime} compression must be lossless`);
    } else assert.deepEqual(data, pdf);
    assert.equal(await storage.deleteIfUnreferenced(receipt), true);
    await assert.rejects(storage.open(receipt), e => e.status === 404);
  }
  const beforeFiles = await countFiles(), beforeMarkers = await countMarkers();
  await assert.rejects(storage.save(file(png, 'image/jpeg')), e => e.status === 400);
  await assert.rejects(storage.save(file(Buffer.from('not an image'), 'image/png')), e => e.status === 400);
  await assert.rejects(storage.save(file(Buffer.from('%PDF-1.4 broken'), 'application/pdf')), e => e.status === 400);
  const corrupt = Buffer.concat([png.subarray(0, 8), Buffer.alloc(12)]);
  await assert.rejects(storage.save(file(corrupt, 'image/png')), e => e.status === 400);
  await request(app).post('/api/bookings').field(fields()).attach('receipt', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(400);
  assert.equal(await countFiles(), beforeFiles); assert.equal(await countMarkers(), beforeMarkers);
});

test('transfer receipts remain private and referenced files cannot be deleted', async () => {
  const response = await request(app).post('/api/admin/transfers').set(auth(staffToken)).field({ bookingId: String(booking._id), amount: '210', method: 'wallet' }).attach('receipt', pdf, { filename: 'receipt.pdf', contentType: 'application/pdf' }).expect(201);
  const transfer = await Transfer.findById(response.body._id);
  assert.equal(transfer.receipt.storage, 'gridfs');
  await request(app).get(`/api/admin/transfers/${transfer._id}/receipt`).expect(401);
  await request(app).get(`/api/admin/transfers/${transfer._id}/receipt`).set(auth(customerToken)).expect(403);
  const receipt = await request(app).get(`/api/admin/transfers/${transfer._id}/receipt`).set(auth(adminToken)).expect(200);
  assert.match(receipt.headers['content-type'], /^application\/pdf/);
  assert.deepEqual(receipt.body, pdf);
  assert.equal(await storage.deleteIfUnreferenced(transfer.receipt), false);
  await Transfer.deleteOne({ _id: transfer._id });
  assert.equal(await storage.deleteIfUnreferenced(transfer.receipt), true);
  const id = new mongoose.Types.ObjectId(transfer.receipt.file);
  assert.equal(await mongoose.connection.db.collection('receipts.files').countDocuments({ _id: id }), 0);
  assert.equal(await mongoose.connection.db.collection('receipts.chunks').countDocuments({ files_id: id }), 0);
});

test('upload and database failures remove only their own unreferenced files', async () => {
  const fileCount = await countFiles(), markerCount = await countMarkers();
  const originalUpload = mongoose.mongo.GridFSBucket.prototype.openUploadStreamWithId;
  let failedId;
  mongoose.mongo.GridFSBucket.prototype.openUploadStreamWithId = id => {
    failedId = id;
    return new Writable({ write(chunk, encoding, callback) { mongoose.connection.db.collection('receipts.chunks').insertOne({ files_id: id, n: 0, data: Buffer.from('partial') }).then(() => callback(new Error('simulated stream failure')), callback); } });
  };
  try { await assert.rejects(storage.save(file(png, 'image/png')), /simulated stream failure/); }
  finally { mongoose.mongo.GridFSBucket.prototype.openUploadStreamWithId = originalUpload; }
  assert.equal(await countFiles(), fileCount); assert.equal(await countMarkers(), markerCount);
  assert.equal(await mongoose.connection.db.collection('receipts.chunks').countDocuments({ files_id: failedId }), 0);
  const originalCreate = Payment.create;
  Payment.create = async () => { throw new Error('simulated database failure'); };
  try { await request(app).post('/api/bookings').field(fields()).attach('receipt', png, { filename: 'test.png', contentType: 'image/png' }).expect(500); }
  finally { Payment.create = originalCreate; }
  assert.equal(await countFiles(), fileCount); assert.equal(await countMarkers(), markerCount);
  Payment.create = async (...args) => { await originalCreate.apply(Payment, args); throw new Error('simulated lost payment acknowledgement'); };
  try { await request(app).post('/api/bookings').field(fields()).attach('receipt', png, { filename: 'test.png', contentType: 'image/png' }).expect(500); }
  finally { Payment.create = originalCreate; }
  assert.equal(await countFiles(), fileCount); assert.equal(await countMarkers(), markerCount);
  const originalTransferCreate = Transfer.create;
  Transfer.create = async () => { throw new Error('simulated database failure'); };
  try { await request(app).post('/api/admin/transfers').set(auth(staffToken)).field({ bookingId: String(booking._id), amount: '210', method: 'wallet' }).attach('receipt', png, { filename: 'test.png', contentType: 'image/png' }).expect(500); }
  finally { Transfer.create = originalTransferCreate; }
  assert.equal(await countFiles(), fileCount); assert.equal(await countMarkers(), markerCount);
});

test('a lost booking or transfer acknowledgement does not remove a committed receipt', async () => {
  const originalBookingCreate = Booking.create;
  Booking.create = async (...args) => { await originalBookingCreate.apply(Booking, args); throw new Error('simulated lost booking acknowledgement'); };
  let response;
  try { response = await request(app).post('/api/bookings').field(fields()).attach('receipt', png, { filename: 'test.png', contentType: 'image/png' }).expect(201); }
  finally { Booking.create = originalBookingCreate; }
  const savedBooking = await Booking.findOne({ bookingId: response.body.bookingId });
  const savedPayment = await Payment.findOne({ booking: savedBooking._id });
  assert.ok(savedPayment?.receipt?.file);
  await request(app).get(`/api/admin/bookings/${savedBooking._id}/receipt`).set(auth(adminToken)).expect(200);
  await Payment.deleteOne({ _id: savedPayment._id });
  assert.equal(await storage.deleteIfUnreferenced(savedPayment.receipt), true);
  await Booking.deleteOne({ _id: savedBooking._id });

  const originalTransferCreate = Transfer.create;
  Transfer.create = async (...args) => { await originalTransferCreate.apply(Transfer, args); throw new Error('simulated lost transfer acknowledgement'); };
  let transferResponse;
  try { transferResponse = await request(app).post('/api/admin/transfers').set(auth(staffToken)).field({ bookingId: String(booking._id), amount: '210', method: 'wallet' }).attach('receipt', png, { filename: 'test.png', contentType: 'image/png' }).expect(201); }
  finally { Transfer.create = originalTransferCreate; }
  const transfer = await Transfer.findById(transferResponse.body._id);
  await request(app).get(`/api/admin/transfers/${transfer._id}/receipt`).set(auth(adminToken)).expect(200);
  await Transfer.deleteOne({ _id: transfer._id });
  assert.equal(await storage.deleteIfUnreferenced(transfer.receipt), true);
});

test('legacy local receipts remain accessible only through the admin route', async () => {
  const dir = path.join(tempDir, 'receipts'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'legacy.png'), png);
  const transfer = await Transfer.create({ booking: booking._id, bookingId: booking.bookingId, amount: 1, method: 'legacy', createdBy: 'test', receipt: { file: 'legacy.png', mime: 'image/png', size: png.length } });
  await request(app).get(`/uploads/receipts/legacy.png`).expect(404);
  const response = await request(app).get(`/api/admin/transfers/${transfer._id}/receipt`).set(auth(staffToken)).expect(200);
  assert.deepEqual(response.body, png);
  await Transfer.deleteOne({ _id: transfer._id });
});

test('stale upload cleanup defaults to dry-run and preserves referenced receipts', async () => {
  const orphan = await storage.save(file(png, 'image/png'));
  const referenced = await storage.save(file(png, 'image/png'));
  const linked = await Payment.create({ booking: new mongoose.Types.ObjectId(), method: 'wallet', amount: 1, receipt: referenced });
  const ids = [orphan, referenced].map(x => new mongoose.Types.ObjectId(x.file));
  await mongoose.connection.db.collection('receipt_uploads').updateMany({ _id: { $in: ids } }, { $set: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
  const env = { ...process.env, MONGODB_URI: mongod.getUri('gridfs_test') };
  const script = path.resolve(__dirname, '../scripts/cleanup-orphan-receipts.js');
  execFileSync(process.execPath, [script], { env, cwd: path.resolve(__dirname, '..') });
  assert.equal(await mongoose.connection.db.collection('receipts.files').countDocuments({ _id: { $in: ids } }), 2);
  execFileSync(process.execPath, [script, '--execute'], { env, cwd: path.resolve(__dirname, '..') });
  assert.equal(await mongoose.connection.db.collection('receipts.files').countDocuments({ _id: ids[0] }), 0);
  assert.equal(await mongoose.connection.db.collection('receipts.files').countDocuments({ _id: ids[1] }), 1);
  assert.equal(await mongoose.connection.db.collection('receipt_uploads').countDocuments({ _id: { $in: ids } }), 0);
  await Payment.deleteOne({ _id: linked._id }); assert.equal(await storage.deleteIfUnreferenced(referenced), true);
});

test('a payment receipt is deleted only after its payment reference is removed', async () => {
  const receipt = payment.receipt;
  const id = new mongoose.Types.ObjectId(receipt.file);
  assert.equal(await storage.deleteIfUnreferenced(receipt), false);
  await Payment.deleteOne({ _id: payment._id });
  assert.equal(await storage.deleteIfUnreferenced(receipt), true);
  assert.equal(await mongoose.connection.db.collection('receipts.files').countDocuments({ _id: id }), 0);
  assert.equal(await mongoose.connection.db.collection('receipts.chunks').countDocuments({ files_id: id }), 0);
  await request(app).get(`/api/admin/bookings/${booking._id}/receipt`).set(auth(adminToken)).expect(404);
});
