// Initialize the first dashboard administrator from backend/.env without changing existing users.
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const Admin = require('../src/models/Admin');
async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 10) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters) in backend/.env');
  await db.connect();
  if (await Admin.exists({})) console.log('Administrator already exists; no account changed.');
  else { await Admin.create({ name: 'مسؤولة الموقع', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' }); console.log('Initial administrator created from backend/.env.'); }
  await db.disconnect();
}
main().catch(async e => { console.error(e.message); await db.disconnect(); process.exitCode = 1; });
