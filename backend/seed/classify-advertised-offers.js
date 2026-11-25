// Fill missing classifications only for the previously imported advertisements.
const db = require('../src/config/db');
const Network = require('../src/models/Network');
const Package = require('../src/models/Package');
async function main() {
  await db.connect();
  const we = await Network.findOne({ key: 'we' });
  if (!we) throw new Error('شبكة WE غير موجودة');
  const landline = await Package.updateMany({ network: we._id, lineType: { $exists: false }, $or: [{ name: /^WE أرضي / }, { name: 'خصم 50% على فاتورة الإنترنت المنزلي' }] }, { $set: { lineType: 'landline' } });
  const gold = await Package.updateMany({ network: we._id, name: /^وي جولد /, $or: [{ validity: '' }, { validity: { $exists: false } }] }, { $set: { validity: 'يوم 1 و16' } });
  console.log(`Classified ${landline.modifiedCount} landline offers; added renewal dates to ${gold.modifiedCount} WE Gold offers.`);
  await db.disconnect();
}
main().catch(async e => { console.error(e.message); await db.disconnect(); process.exitCode = 1; });
