// Idempotent: never overwrites prices or settings edited from the dashboard.
const bcrypt = require('bcryptjs');
const cfg = require('../src/config/env');
const db = require('../src/config/db');
const Admin = require('../src/models/Admin');
const Network = require('../src/models/Network');
const Package = require('../src/models/Package');
const Settings = require('../src/models/WebsiteSettings');

const NETWORKS = [ // accent colours only; official logos must be uploaded by the owner from the dashboard
  { key: 'vodafone', nameAr: 'فودافون', nameEn: 'Vodafone', color: '#e60000', sortOrder: 1 },
  { key: 'etisalat', nameAr: 'اتصالات', nameEn: 'Etisalat', color: '#5cb85c', sortOrder: 2 },
  { key: 'orange', nameAr: 'أورنچ', nameEn: 'Orange', color: '#ff7900', sortOrder: 3 },
  { key: 'we', nameAr: 'وي', nameEn: 'WE', color: '#7b4cc9', sortOrder: 4 },
];
async function main() {
  const own = require('mongoose').connection.readyState === 0;
  if (own) await db.connect();
  for (const n of NETWORKS) await Network.updateOne({ key: n.key }, { $setOnInsert: n }, { upsert: true });
  const net = Object.fromEntries((await Network.find()).map(n => [n.key, n._id]));

  if (!(await Package.countDocuments())) {
    await Package.insertMany([
      { network: net.vodafone, name: '10,400 فليكس', category: 'flex', internetQuota: '', minutes: '10,400 فليكس', price: 210, isFeatured: true, sortOrder: 1 },
      { network: net.vodafone, name: '5,200 فليكس', category: 'flex', minutes: '5,200 فليكس', price: 110, sortOrder: 2 },
      { network: net.vodafone, name: 'تجديد فليكس 300', category: 'flex', price: 310, sortOrder: 3 },
      { network: net.vodafone, name: '26,000 خط - 3 شهور', category: 'lines', validity: '3 شهور', price: 270, sortOrder: 4 },
      {
        network: net.etisalat, name: 'كانسلت اتصالات', category: 'service', internetQuota: '40 جيجا', price: 450,
        priceNote: '450 جنيه لأول شهر، وبعدها 200 جنيه شهريًا.', sortOrder: 1,
        extraDetails: [
          { label: 'الرصيد الصافي', value: '123,000' },
          { label: 'السعر بعد أول شهر', value: '200 جنيه' },
        ] },
    ]);
    console.log('[seed] default package catalog inserted');
  }

  // One-time, idempotent price migration for the original seeded catalog.
  for (const [name, from, to] of [
    ['10,400 فليكس', 230, 210], ['5,200 فليكس', 130, 110],
    ['تجديد فليكس 300', 330, 310], ['26,000 خط - 3 شهور', 290, 270],
  ]) {
    await Package.updateOne({ name, price: from }, { $set: { price: to, priceNote: '', extraDetails: [] } });
  }
  await Package.updateOne(
    { name: { $in: ['خدمة إلغاء اتصالات (Cancel)', 'كانسلت اتصالات'] }, price: { $in: [null, 450] } },
    { $set: {
      name: 'كانسلت اتصالات', price: 450, internetQuota: '40 جيجا', priceNote: '450 جنيه لأول شهر، وبعدها 200 جنيه شهريًا.', isAvailable: true,
      extraDetails: [{ label: 'الرصيد الصافي', value: '123,000' }, { label: 'السعر بعد أول شهر', value: '200 جنيه' }],
    } },
  );

  await Settings.updateOne({ key: 'main' }, { $setOnInsert: {
    key: 'main',
    paymentMethods: [
      { key: 'vodafone_cash', label: 'فودافون كاش', accountNumber: '', accountName: '', instructions: 'حوّل المبلغ ثم ارفع صورة الإيصال', requiresReceipt: true, enabled: true },
      { key: 'instapay', label: 'إنستا باي', accountNumber: '', accountName: '', instructions: 'حوّل المبلغ ثم ارفع صورة الإيصال', requiresReceipt: true, enabled: true },
    ],
    faq: [
      { q: 'إزاي أحجز تجديد باقتي؟', a: 'اختار الشبكة ثم الباقة، اكتب بياناتك ورقم التجديد، حوّل المبلغ وارفع الإيصال، وهيوصلك رقم طلب.' },
      { q: 'إمتى بيتأكد الدفع؟', a: 'فريقنا بيراجع إيصال الدفع يدوياً، ومفيش طلب بيتأكد أو بيتفعل غير بعد مراجعة المسؤول.' },
      { q: 'إزاي أتابع طلبي؟', a: 'من صفحة "طلباتي" بكتابة رقم الطلب ورقم موبايلك المسجل.' },
      { q: 'إزاي أتواصل بخصوص طلبي؟', a: 'تابعي حالة الطلب من صفحة "طلباتي"، أو تواصلي معنا من صفحة "تواصل معنا".' },
    ],
  } }, { upsert: true });
  await Settings.updateOne({ key: 'main', businessName: 'تيم التنازلي 👑' }, { $set: { businessName: 'تيم النزلاوي 👑' } });
  await Settings.updateOne({ key: 'main', 'faq.q': 'هتوصلني إشعارات؟' }, { $set: { 'faq.$.q': 'إزاي أتواصل بخصوص طلبي؟', 'faq.$.a': 'تابعي حالة الطلب من صفحة "طلباتي"، أو تواصلي معنا من صفحة "تواصل معنا".' } });
  await Settings.updateOne({ key: 'main' }, { $unset: { whatsapp: 1 } });

  if (cfg.env !== 'test' && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
    await Admin.updateOne({ email: process.env.ADMIN_EMAIL.toLowerCase() }, { $setOnInsert: {
      name: process.env.ADMIN_NAME || 'Team Leader', email: process.env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' } }, { upsert: true });
    console.log('[seed] admin ready:', process.env.ADMIN_EMAIL);
  } else console.log('[seed] ADMIN_EMAIL/ADMIN_PASSWORD not set - no admin created');
  if (own) await db.disconnect();
}
module.exports = main;
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
