const app = require('./app');
const cfg = require('./config/env');
const db = require('./config/db');
const UserAccount = require('./models/UserAccount');

(async () => {
  await db.connect();
  await UserAccount.init();
  const server = app.listen(cfg.port, () => console.log(`[server] http://localhost:${cfg.port}  (${cfg.env})`));
  const stop = async () => { server.close(); await db.disconnect(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})().catch(e => { console.error('[fatal]', e.message); process.exit(1); });
