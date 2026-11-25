const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const cfg = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (o, cb) => cb(null, !o || cfg.corsOrigins.includes(o)), methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '200kb' }));
app.use('/uploads/public', express.static(path.join(cfg.uploadDir, 'public'), { maxAge: '7d', setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff') }));
// NOTE: /uploads/receipts is deliberately NOT served statically - receipts are only reachable via the authenticated admin endpoint.
app.use('/api', apiLimiter, routes);
if (cfg.frontendDist) { // optional single-process deployment: serve the built Angular app + SPA fallback
  app.use(express.static(cfg.frontendDist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(cfg.frontendDist, 'index.html')));
}
app.use(notFound);
app.use(errorHandler);
module.exports = app;
