const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('../config/env');
const { httpError } = require('../utils/helpers');

const SIGS = [
  { ext: '.jpg', mime: 'image/jpeg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', mime: 'image/png', test: b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.webp', mime: 'image/webp', test: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
  { ext: '.pdf', mime: 'application/pdf', test: b => b.slice(0, 5).toString() === '%PDF-' },
];
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
exports.single = field => memory.single(field);

// Trust the file's magic bytes, not the client-supplied mimetype/extension.
exports.saveVerified = (file, { dir, allowPdf }) => {
  if (!file) return null;
  const sig = SIGS.find(s => s.test(file.buffer) && (allowPdf || s.ext !== '.pdf'));
  if (!sig) throw httpError(400, allowPdf ? 'الملف لازم يكون صورة (JPG/PNG/WebP) أو PDF' : 'الملف لازم يكون صورة (JPG/PNG/WebP)');
  const target = path.join(cfg.uploadDir, dir);
  fs.mkdirSync(target, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex') + sig.ext;
  fs.writeFileSync(path.join(target, name), file.buffer, { mode: 0o640 });
  return { file: name, mime: sig.mime, size: file.size, originalName: String(file.originalname || '').slice(0, 120) };
};
