// Remove the specific advertisement text from the existing Vodafone Red offers.
const db = require('../src/config/db');
const Network = require('../src/models/Network');
const Package = require('../src/models/Package');

async function main() {
  await db.connect();
  const network = await Network.findOne({ key: 'vodafone' });
  if (!network) throw new Error('Vodafone network not found');
  const description = 'الإعلان يذكر: الميجا من موبايل لكل المواقع، لدقيقة ودقيقة لكل الشبكات، سطر غير واضح في الإعلان مكتوب فيه «ميجاوات عالية وسرعة ثابتة»، عرض نظام 15 شهر، الخط يكون باسمك. تفاصيل الإعلان كما وردت، ولم تُراجع مع الشركات. يرجى التأكد من التفاصيل والشروط عند التواصل.';
  const result = await Package.updateMany({ network: network._id, name: /^فودافون ريد \d+ جيجا$/, description }, { $set: { description: '' } });
  console.log(`Updated ${result.modifiedCount} Vodafone Red offers.`);
  await db.disconnect();
}
main().catch(async e => { console.error(e.message); await db.disconnect(); process.exitCode = 1; });
