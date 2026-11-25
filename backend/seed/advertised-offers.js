// Import the offer details supplied by the site owner. Existing named offers are preserved.
const db = require('../src/config/db');
const Network = require('../src/models/Network');
const Package = require('../src/models/Package');

const disclaimer = 'تفاصيل الإعلان كما وردت، ولم تُراجع مع الشركات. يرجى التأكد من التفاصيل والشروط عند التواصل.';
const contact = { label: 'التواصل والتفعيل', value: 'واتساب 01121844925' };
const offers = [];
function add(network, name, category, fields) {
  offers.push({ network, name, category, isAvailable: true, isFeatured: false, ...fields });
}

add('we', 'خصم 50% على فاتورة الإنترنت المنزلي', 'service', {
  lineType: 'landline', price: null, description: `${disclaimer} الإعلان لا يتضمن أسعارًا أو شروطًا أو جهة تواصل.`,
  priceNote: 'سعر التفعيل والشروط غير مذكورين في الإعلان.', sortOrder: 100,
});
for (const [quota, full, discounted] of [[150,296,148],[200,376,190],[250,450,225],[300,524,260],[400,661,330],[500,752,375],[750,1054,525],[1000,1410,705],[1500,1880,940]]) {
  add('we', `WE أرضي ${quota} جيجا — خصم 50%`, 'internet', {
    lineType: 'landline', internetQuota: `${quota} جيجا`, price: null,
    extraDetails: [{ label: 'سعر الباقة بعد الزيادة', value: `${full} جنيه` }, { label: 'السعر بعد الخصم كما بالإعلان', value: `${discounted} جنيه` }, { label: 'سعر تفعيل الخصم', value: 'غير مذكور' }, { label: 'الاسم على الإعلان', value: 'زياد اسامه' }],
    description: `${disclaimer} الإعلان لا يذكر جهة تواصل.`, priceNote: 'سعر التفعيل غير مذكور؛ السعر المعروض هو سعر الباقة بعد الخصم.', sortOrder: 100 + quota,
  });
}
for (const [quota, balance, cash, first, later] of [[30,123,200,450,200],[40,175,250,500,250],[50,210,300,550,300],[60,245,350,650,350],[100,300,430,750,430]]) {
  add('etisalat', `كنسلة اتصالات ${quota} جيجا`, 'service', {
    internetQuota: `${quota} جيجا`, price: first,
    extraDetails: [{ label: 'الرصيد الصافي', value: `${balance}` }, { label: 'قيمة الفلوس', value: `${cash} جنيه` }, { label: 'الدفع أول شهر', value: `${first} جنيه` }, { label: 'الدفع بعد كده', value: `${later} جنيه` }, contact],
    description: `الإعلان يذكر: باقات رسمية من اتصالات، مكالمات لجميع الشبكات، إنترنت قوي وسريع، أفضل الأسعار مع تيم النزلاوي. ${disclaimer}`,
    priceNote: 'السعر المعروض للدفع أول شهر.', sortOrder: 200 + quota,
  });
}
function addMobile(network, title, rows, description, order) {
  for (const [quota, mins, price] of rows) {
    add(network, `${title} ${quota} جيجا`, 'minutes_internet', {
      internetQuota: `${quota} جيجا`, minutes: `${mins} دقيقة`, price, ...(title === 'وي جولد' ? { validity: 'يوم 1 و16' } : {}),
      extraDetails: [contact], description: description ? `الإعلان يذكر: ${description} ${disclaimer}` : '', sortOrder: order + quota,
    });
  }
}
addMobile('etisalat', 'اتصالات من فرحات', [[14,1500,290],[20,1500,350],[28,1500,450],[35,1500,500],[40,1700,560],[50,1700,670],[65,1700,780]], 'الإنترنت متاح لكل المواقع، الدقيقة بدقيقة لكل الشبكات، سوشيال على مسار الباقة، على نظام 15 قرش، الشريحة بدون بصمات.', 400);
addMobile('we', 'وي جولد', [[5,500,170],[10,500,210],[20,1000,310],[30,1500,390],[40,1500,490],[50,1500,550],[70,1500,740],[80,1500,790]], 'الإنترنت متاح لكل المواقع، الدقيقة بدقيقة لكل الشبكات، أي سلف على الخط، على نظام 12 قرش، التجديد يوم 1 و16. التفاصيل والشروط عند التواصل.', 500);
addMobile('vodafone', 'فودافون ريد', [[20,1500,450],[25,1500,510],[30,1500,560],[40,1500,660],[50,1500,720],[65,1500,880],[80,1500,980]], '', 600);

async function main() {
  await db.connect();
  const networks = await Network.find({ key: { $in: ['we', 'etisalat', 'vodafone'] } });
  const ids = Object.fromEntries(networks.map(n => [n.key, n._id]));
  if (!ids.we || !ids.etisalat || !ids.vodafone) throw new Error('الشبكات المطلوبة غير موجودة');
  const legacy = await Package.find({ network: ids.etisalat, name: 'كانسلت اتصالات', internetQuota: '40 جيجا', price: 450 });
  if (legacy.length > 1) throw new Error('يوجد أكثر من عرض قديم مطابق؛ يلزم مراجعته قبل الاستيراد');
  const target = offers.find(o => o.name === 'كنسلة اتصالات 30 جيجا');
  if (legacy.length && !(await Package.exists({ network: ids.etisalat, name: target.name }))) {
    await Package.updateOne({ _id: legacy[0]._id }, { $set: { ...target, network: ids.etisalat } }, { runValidators: true });
    console.log('Updated the mismatched legacy cancellation offer');
  }
  let added = 0;
  for (const offer of offers) {
    const network = ids[offer.network];
    const result = await Package.updateOne({ network, name: offer.name }, { $setOnInsert: { ...offer, network } }, { upsert: true, runValidators: true });
    added += result.upsertedCount;
  }
  console.log(`Imported ${added} new offers; existing named offers preserved.`);
  await db.disconnect();
}
main().catch(async e => { console.error(e.message); await db.disconnect(); process.exitCode = 1; });
