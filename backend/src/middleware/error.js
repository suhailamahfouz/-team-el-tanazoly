const { ZodError } = require('zod');
const cfg = require('../config/env');
exports.notFound = (req, res) => res.status(404).json({ message: 'المسار غير موجود' });
exports.errorHandler = (err, req, res, next) => { // eslint-disable-line
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'بيانات غير صحيحة', errors: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })) });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'معرّف غير صالح' });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف أكبر من 5MB' : 'خطأ في رفع الملف' });
  if (err.code === 11000) return res.status(409).json({ message: 'القيمة موجودة بالفعل' });
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ message: err.expose ? err.message : 'حدث خطأ غير متوقع', ...(cfg.isProd ? {} : status >= 500 ? { debug: err.message } : {}) });
};
