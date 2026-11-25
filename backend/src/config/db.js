const mongoose = require('mongoose');
const cfg = require('./env');
mongoose.set('strictQuery', true);
module.exports = {
  connect: (uri = cfg.mongoUri) => mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }),
  disconnect: () => mongoose.disconnect(),
};
