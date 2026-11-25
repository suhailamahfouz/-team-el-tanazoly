const crypto = require('crypto');
exports.asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.httpError = (status, message, extra) => Object.assign(new Error(message), { status, expose: true, ...extra });
exports.escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Egyptian mobile: 01[0125]XXXXXXXX. Accepts +20 / 0020 / 20 prefixes.
exports.normalizePhone = (input) => {
  let d = String(input || '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
  d = d.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)); // Arabic-Indic digits
  if (d.startsWith('0020')) d = d.slice(4); else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  if (!d.startsWith('0') && d.length === 10) d = '0' + d;
  return /^01[0125]\d{8}$/.test(d) ? d : null;
};
exports.maskPhone = p => p ? p.slice(0, 3) + '*****' + p.slice(-3) : '';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
exports.generateBookingId = () => 'TT-' + Array.from(crypto.randomBytes(7), b => ALPHABET[b % ALPHABET.length]).join('');
exports.paginate = (q, def = 20) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || def));
  return { page, limit, skip: (page - 1) * limit };
};
