const mongoose = require('mongoose');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const cfg = require('../config/env');
const { httpError } = require('../utils/helpers');

const BUCKET = 'receipts';
const STAGING = 'receipt_uploads';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const TYPES = [
  { mime: 'image/jpeg', format: 'jpeg', ext: '.jpg', match: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', format: 'png', ext: '.png', match: b => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', format: 'webp', ext: '.webp', match: b => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', format: 'pdf', ext: '.pdf', match: b => b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-' },
];

function bucket() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) throw new Error('Database connection is unavailable');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

async function prepare(file) {
  if (!file) throw httpError(400, 'إثبات الدفع مطلوب');
  if (!Buffer.isBuffer(file.buffer) || !file.buffer.length || file.buffer.length > MAX_BYTES || file.size !== file.buffer.length) throw httpError(400, 'حجم الملف غير صالح (الحد الأقصى 5MB)');
  const type = TYPES.find(t => t.match(file.buffer));
  if (!type || file.mimetype !== type.mime) throw httpError(400, 'نوع الملف لا يطابق محتواه؛ استخدم JPG أو PNG أو WebP أو PDF');
  if (type.format === 'pdf') return { type, buffer: file.buffer };
  try {
    const source = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning', animated: false });
    const metadata = await source.metadata();
    if (metadata.format !== type.format || !metadata.width || !metadata.height || (metadata.pages || 1) > 1) throw new Error('Invalid image');
    // Never resize. Preserve detail with lossless PNG/WebP or high-quality, full-colour JPEG.
    let output = source.rotate();
    if (type.format === 'jpeg') output = output.jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true });
    else if (type.format === 'png') output = output.png({ compressionLevel: 9, palette: false });
    else output = output.webp({ lossless: true, effort: 4 });
    const compressed = await output.toBuffer();
    return { type, buffer: compressed.length < file.buffer.length ? compressed : file.buffer };
  } catch { throw httpError(400, 'الصورة غير صالحة أو أبعادها كبيرة جدًا'); }
}

async function removeGridFile(id) {
  const oid = new mongoose.Types.ObjectId(id);
  try { await bucket().delete(oid); }
  catch (err) {
    // A failed upload may have chunks but no completed files document.
    const existing = await mongoose.connection.db.collection(`${BUCKET}.files`).findOne({ _id: oid });
    if (existing) throw err;
    await mongoose.connection.db.collection(`${BUCKET}.chunks`).deleteMany({ files_id: oid });
  }
}

exports.save = async file => {
  const { type, buffer } = await prepare(file);
  const id = new mongoose.Types.ObjectId();
  const filename = crypto.randomBytes(16).toString('hex') + type.ext;
  // Persist an upload marker first so an interrupted process can be cleaned up later.
  await mongoose.connection.db.collection(STAGING).insertOne({ _id: id, createdAt: new Date(), source: 'team-el-tanazoly' });
  const stream = bucket().openUploadStreamWithId(id, filename, { metadata: { source: 'team-el-tanazoly', mime: type.mime } });
  try { await pipeline(Readable.from(buffer), stream); }
  catch (err) { try { await removeGridFile(id); await mongoose.connection.db.collection(STAGING).deleteOne({ _id: id, source: 'team-el-tanazoly' }); } catch (cleanupError) { console.error('[receipt] failed to clean incomplete upload:', cleanupError.message); } throw err; }
  return { file: String(id), storage: 'gridfs', mime: type.mime, size: buffer.length, originalName: String(file.originalname || '').slice(0, 120) };
};

exports.deleteIfUnreferenced = async receipt => {
  if (!receipt || receipt.storage !== 'gridfs' || !mongoose.isValidObjectId(receipt.file)) return false;
  const Payment = require('../models/Payment');
  const Transfer = require('../models/Transfer');
  const filter = { 'receipt.storage': 'gridfs', 'receipt.file': String(receipt.file) };
  if (await Payment.exists(filter) || await Transfer.exists(filter)) return false;
  const oid = new mongoose.Types.ObjectId(receipt.file);
  const marker = await mongoose.connection.db.collection(STAGING).findOne({ _id: oid, source: 'team-el-tanazoly' });
  const file = await mongoose.connection.db.collection(`${BUCKET}.files`).findOne({ _id: oid, 'metadata.source': 'team-el-tanazoly' });
  if (!marker && !file) return false;
  await removeGridFile(receipt.file);
  await mongoose.connection.db.collection(STAGING).deleteOne({ _id: oid, source: 'team-el-tanazoly' });
  return true;
};

exports.markCommitted = async receipt => {
  if (!receipt || receipt.storage !== 'gridfs' || !mongoose.isValidObjectId(receipt.file)) return;
  // Failure here does not invalidate a saved receipt; the maintenance command checks references.
  try { await mongoose.connection.db.collection(STAGING).deleteOne({ _id: new mongoose.Types.ObjectId(receipt.file), source: 'team-el-tanazoly' }); }
  catch (err) { console.error('[receipt] could not clear upload marker:', err.message); }
};

exports.open = async receipt => {
  if (!receipt?.file) throw httpError(404, 'لا يوجد إيصال');
  if (receipt.storage === 'gridfs') {
    if (!mongoose.isValidObjectId(receipt.file)) throw httpError(404, 'الإيصال غير موجود');
    const id = new mongoose.Types.ObjectId(receipt.file);
    const doc = await mongoose.connection.db.collection(`${BUCKET}.files`).findOne({ _id: id });
    if (!doc || !TYPES.some(t => t.mime === doc.metadata?.mime)) throw httpError(404, 'الإيصال غير موجود');
    return { mime: doc.metadata.mime, stream: bucket().openDownloadStream(id) };
  }
  if (receipt.storage && receipt.storage !== 'local') throw httpError(404, 'الإيصال غير موجود');
  const root = path.resolve(cfg.uploadDir, 'receipts');
  const filename = path.basename(receipt.file);
  const file = path.resolve(root, filename);
  if (filename !== receipt.file || path.dirname(file) !== root || !TYPES.some(t => t.mime === receipt.mime)) throw httpError(404, 'الإيصال غير موجود');
  try { const stat = await fs.promises.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid legacy file'); }
  catch { throw httpError(404, 'الإيصال غير موجود'); }
  return { mime: receipt.mime, stream: fs.createReadStream(file) };
};
