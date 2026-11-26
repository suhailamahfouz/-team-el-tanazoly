// Dry-run by default. Only staged uploads older than 24 hours are considered.
const mongoose = require('mongoose');
const db = require('../src/config/db');
const Payment = require('../src/models/Payment');
const Transfer = require('../src/models/Transfer');
const storage = require('../src/services/receiptStorage');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--execute')) throw new Error('Usage: npm run receipts:cleanup -- [--execute]');
  const execute = args.includes('--execute');
  await db.connect();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cursor = mongoose.connection.db.collection('receipt_uploads').find({ source: 'team-el-tanazoly', createdAt: { $lt: cutoff } });
  let orphaned = 0, referenced = 0;
  for await (const marker of cursor) {
    const receipt = { storage: 'gridfs', file: String(marker._id) };
    const filter = { 'receipt.storage': 'gridfs', 'receipt.file': receipt.file };
    if (await Payment.exists(filter) || await Transfer.exists(filter)) {
      referenced++;
      if (execute) await storage.markCommitted(receipt);
    } else {
      orphaned++;
      if (execute) await storage.deleteIfUnreferenced(receipt);
    }
  }
  console.log(`${execute ? 'Cleanup completed' : 'Dry run'}: ${orphaned} orphaned upload(s), ${referenced} referenced upload marker(s).`);
  await db.disconnect();
}
main().catch(async err => { console.error('Receipt cleanup failed:', err.message); await db.disconnect(); process.exitCode = 1; });
