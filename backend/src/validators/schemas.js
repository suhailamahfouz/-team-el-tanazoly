const { z } = require('zod');
const { normalizePhone } = require('../utils/helpers');
const { CATEGORIES } = require('../models/Package');

const phone = z.string().trim().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) ctx.addIssue({ code: 'custom', message: 'رقم موبايل مصري غير صحيح (مثال: 010XXXXXXXX)' });
  return n;
});
const oid = z.string().regex(/^[a-f\d]{24}$/i, 'معرّف غير صالح');
const price = z.union([z.number(), z.string(), z.null()]).transform(v => (v === '' || v === null ? null : Number(v))).refine(v => v === null || (Number.isFinite(v) && v >= 0 && v <= 100000), 'سعر غير صالح');

exports.createBooking = z.object({
  packageId: oid,
  customerName: z.string().trim().min(2, 'الاسم قصير').max(100),
  customerPhone: phone,
  renewalPhone: phone,
  paymentMethod: z.string().trim().min(1).max(50),
});
const linePhone = z.string().trim().transform((v, ctx) => {
  const normalized = normalizePhone(v);
  if (normalized) return normalized;
  const digits = v.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[\s\-()]/g, '');
  if (!/^0[2-9]\d{7,9}$/.test(digits)) ctx.addIssue({ code: 'custom', message: 'رقم الخط غير صحيح' });
  return digits;
});
exports.renewalRequest = z.object({ packageId: oid, customerPhone: phone, renewalPhone: linePhone });
exports.paidRenewalRequest = exports.renewalRequest.extend({
  paymentMethod: z.string().trim().min(1).max(50),
  quotedPrice: z.string().trim().min(1).transform(Number).refine(v => Number.isFinite(v) && v >= 0 && v <= 100000, 'السعر غير صالح'),
});
exports.submitPayment = z.object({ bookingId: z.string().trim().toUpperCase().regex(/^TT-[A-Z0-9]{7}$/), phone, paymentMethod: z.string().trim().min(1).max(50) });
exports.track = z.object({ bookingId: z.string().trim().toUpperCase().regex(/^TT-[A-Z0-9]{7}$/, 'رقم الطلب غير صحيح'), phone });
exports.login = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
exports.accountLogin = z.object({ identifier: z.string().trim().min(1).max(200).optional(), email: z.string().trim().min(1).max(200).optional(), password: z.string().min(1).max(200) }).refine(v => v.identifier || v.email, { message: 'اكتب رقم الموبايل أو البريد الإلكتروني' });
exports.registerAccount = z.object({
  name: z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(100),
  phone,
  password: z.string().min(10, 'كلمة المرور يجب أن تكون 10 أحرف على الأقل').refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'كلمة المرور طويلة جدًا'),
});
exports.reject = z.object({ reason: z.string().trim().min(3, 'سبب الرفض مطلوب').max(300) });
exports.note = z.object({ text: z.string().trim().min(1).max(500) });
exports.bookingUpdate = z.object({
  customerName: z.string().trim().min(2).max(100).optional(),
  customerPhone: phone.optional(),
  renewalPhone: linePhone.optional(),
  price: z.number().finite().min(0).max(100000).optional(),
  paymentMethod: z.string().trim().min(1).max(50).optional(),
  packageName: z.string().trim().min(2).max(150).optional(),
  networkName: z.string().trim().min(2).max(80).optional(),
  rejectionReason: z.string().trim().max(300).optional(),
});
exports.transferCreate = z.object({
  bookingId: oid,
  amount: z.union([z.number(), z.string().trim().min(1)]).transform(Number).refine(v => Number.isFinite(v) && v >= 0 && v <= 100000, 'مبلغ التحويل غير صالح'),
  method: z.string().trim().min(2).max(60),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});
exports.transferReview = z.object({ status: z.enum(['confirmed', 'rejected']), note: z.string().trim().max(500).optional() });
exports.whatsappOpen = z.object({
  bookingId: oid,
  recipientType: z.enum(['customer', 'renewal']),
  to: phone,
  body: z.string().trim().min(1).max(4096),
  event: z.enum(['booking_created', 'activated', 'custom']),
});
exports.whatsappConfirm = z.object({ manuallyConfirmed: z.literal(true) });

const extra = z.array(z.object({ label: z.string().max(80), value: z.string().max(200), note: z.string().max(300).optional() })).max(20);
const pkgBase = {
  network: oid, name: z.string().trim().min(2).max(150), category: z.enum(CATEGORIES), lineType: z.enum(['mobile', 'landline']).optional(),
  internetQuota: z.string().trim().max(80).optional(), minutes: z.string().trim().max(80).optional(), validity: z.string().trim().max(80).optional(), firstTimeFee: z.string().trim().max(200).optional(),
  description: z.string().max(1000).optional(), price, priceNote: z.string().max(300).optional(), extraDetails: extra.optional(),
  isAvailable: z.boolean().optional(), isFeatured: z.boolean().optional(), imageUrl: z.string().regex(/^(\/uploads\/public\/[a-f0-9]+\.(jpg|png|webp))?$/).optional(), sortOrder: z.number().optional(),
};
exports.packageCreate = z.object(pkgBase);
exports.packageUpdate = z.object(pkgBase).partial();
exports.bulkPrice = z.object({
  delta: z.number().int().min(-10000).max(10000).refine(v => v !== 0, 'القيمة لا يمكن أن تكون صفر'),
  network: oid.optional(), packageIds: z.array(oid).optional(), dryRun: z.boolean().default(true),
});
exports.networkUpsert = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,20}$/), nameAr: z.string().trim().min(2).max(50), nameEn: z.string().trim().min(2).max(50),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), logoUrl: z.string().regex(/^(\/uploads\/public\/[a-f0-9]+\.(jpg|png|webp))?$/).optional(), description: z.string().max(300).optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(),
});
exports.settingsUpdate = z.object({
  businessName: z.string().max(100).optional(), logoUrl: z.string().regex(/^(\/uploads\/public\/[a-f0-9]+\.(jpg|png|webp))?$/).optional(), tagline: z.string().max(200).optional(),
  contact: z.object({ whatsapp: z.string().max(20), phone: z.string().max(20), email: z.string().max(100), hours: z.string().max(100) }).partial().optional(),
  paymentMethods: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_-]{2,30}$/), label: z.string().max(60), accountNumber: z.string().max(60).optional(), accountName: z.string().max(80).optional(),
    instructions: z.string().max(300).optional(), requiresReceipt: z.boolean().optional(), enabled: z.boolean().optional(),
  })).max(12).optional(),
  faq: z.array(z.object({ q: z.string().max(200), a: z.string().max(1000) })).max(30).optional(),
});
