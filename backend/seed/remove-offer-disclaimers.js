// Remove the requested wording while preserving all other offer details and prices.
const db = require('../src/config/db');
const Package = require('../src/models/Package');

async function main() {
  await db.connect();
  const disclaimer = 'تفاصيل الإعلان كما وردت، ولم تُراجع مع الشركات. يرجى التأكد من التفاصيل والشروط عند التواصل.';
  const contactNote = 'الإعلان لا يذكر جهة تواصل.';
  const priceNote = 'سعر التفعيل غير مذكور؛ السعر المعروض هو سعر الباقة بعد الخصم.';
  const items = await Package.find({ $or: [{ description: { $regex: 'تفاصيل الإعلان كما وردت' } }, { description: { $regex: 'الإعلان لا يذكر جهة تواصل' } }, { priceNote: { $regex: 'سعر التفعيل غير مذكور؛ السعر المعروض هو سعر الباقة بعد الخصم' } }] }).select('description priceNote');
  let changed = 0, skipped = 0;
  for (const item of items) {
    const originalDescription = item.description || '';
    const originalPriceNote = item.priceNote || '';
    const description = originalDescription.replaceAll(disclaimer, '').replaceAll(contactNote, '').trim();
    const newPriceNote = originalPriceNote.replaceAll(priceNote, '').trim();
    const result = await Package.updateOne({ _id: item._id, description: originalDescription, priceNote: originalPriceNote }, { $set: { description, priceNote: newPriceNote } });
    if (result.modifiedCount) changed++; else skipped++;
  }
  console.log(`Updated ${changed} offers; skipped ${skipped} changed concurrently.`);
  await db.disconnect();
}
main().catch(async e => { console.error(e.message); await db.disconnect(); process.exitCode = 1; });
