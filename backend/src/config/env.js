require('dotenv').config();
const crypto = require('crypto');
const e = process.env;
const isProd = e.NODE_ENV === 'production';

let jwtSecret = e.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) throw new Error('JWT_SECRET (>=32 chars) is required in production');
  jwtSecret = crypto.randomBytes(48).toString('hex'); // ephemeral in dev/test
  if (e.NODE_ENV !== 'test') console.warn('[config] JWT_SECRET missing - using an ephemeral dev secret');
}

module.exports = {
  env: e.NODE_ENV || 'development',
  isProd,
  port: Number(e.PORT || 4000),
  mongoUri: e.MONGODB_URI || 'mongodb://127.0.0.1:27017/team-el-tanazoly',
  jwtSecret,
  jwtExpiresIn: e.JWT_EXPIRES_IN || '8h',
  corsOrigins: (e.CORS_ORIGINS || 'http://localhost:4200').split(',').map(s => s.trim()).filter(Boolean),
  frontendDist: e.FRONTEND_DIST ? require('path').resolve(e.FRONTEND_DIST) : '',
  uploadDir: require('path').resolve(e.UPLOAD_DIR || './uploads'),
  rateLimitDisabled: e.NODE_ENV === 'test' || e.RATE_LIMIT_DISABLED === 'true',
};
