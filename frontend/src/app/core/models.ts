export interface Network { _id: string; key: string; nameAr: string; nameEn: string; color: string; logoUrl: string; description?: string; isActive: boolean; sortOrder: number; }
export interface Extra { label: string; value: string; note?: string; }
export interface Pkg {
  _id: string; network: Network | string; name: string; category: string; lineType?: 'mobile' | 'landline'; internetQuota: string; minutes: string; validity: string; firstTimeFee?: string; description: string;
  price: number | null; priceNote: string; extraDetails: Extra[]; isAvailable: boolean; isFeatured: boolean; isBookable: boolean; imageUrl: string; sortOrder: number;
}
export interface PaymentMethod { key: string; label: string; accountNumber: string; accountName: string; instructions: string; requiresReceipt: boolean; enabled: boolean; }
export interface Settings {
  businessName: string; tagline: string; logoUrl: string; contact: { whatsapp: string; phone: string; email: string; hours: string };
  paymentMethods: PaymentMethod[]; faq: { q: string; a: string }[];
}
export interface Transfer {
  _id: string; booking: string | { _id: string; customerName: string }; bookingId: string; amount: number; method: string; reference: string; note: string;
  status: 'pending' | 'confirmed' | 'rejected'; createdBy: string; reviewedBy?: string; reviewedAt?: string; createdAt: string;
  receipt?: { file?: string; url?: string; mime?: string; originalName?: string };
}
export interface BookingAuditEntry {
  action: 'updated' | 'transfer_added' | 'transfer_reviewed'; at: string; by: string;
  changes: { field: string; before: unknown; after: unknown }[];
}
export interface Booking {
  _id: string; bookingId: string; customerName: string; customerPhone: string; renewalPhone: string; networkName: string; network: string; workflow?: 'legacy' | 'review_first' | 'payment_first';
  packageSnapshot: { name: string; internetQuota: string; minutes: string; validity: string }; price: number | null; paymentMethod: string; status: string;
  statusHistory: { status: string; at: string; by: string; note?: string }[]; rejectionReason?: string; adminNotes: { text: string; by: string; at: string }[];
  auditTrail: BookingAuditEntry[]; transfers?: Transfer[]; createdAt: string;
  payment?: { status: string; receipt?: { url: string; mime: string; originalName: string } } | null; messages?: WaMessage[];
}
export interface WaMessage {
  _id: string; booking?: string; bookingId: string; event: string; to: string; recipientType?: 'customer' | 'renewal';
  status: string; body: string; openedAt?: string; manuallyConfirmedAt?: string; manuallyConfirmedBy?: string; createdAt: string; direction: string;
}
export interface Page<T> { items: T[]; total: number; page: number; pages: number; }
export interface MyOrder { bookingId: string; status: string; networkName: string; packageName: string; price: number | null; createdAt: string; }

export const STATUS_LABEL: Record<string, string> = {
  pending: 'مستني المراجعة', awaiting_payment: 'مستني الدفع', payment_review: 'مستني مراجعة الدفع', payment_confirmed: 'جاري التنفيذ', processing: 'جاري التنفيذ',
  activated: 'تم التجديد', rejected: 'مرفوض', cancelled: 'ملغي',
};
export const CATEGORY_LABEL: Record<string, string> = {
  internet: 'إنترنت فقط', minutes_internet: 'دقائق + إنترنت', special: 'عروض خاصة', flex: 'فليكس', lines: 'خطوط', service: 'خدمة',
};
export const WA_STATUS_LABEL: Record<string, string> = {
  prepared: 'جاهزة للفتح', opened: 'تم فتح واتساب', manually_confirmed: 'أكد الأدمن الإرسال يدويًا', confirmed: 'تم التأكيد',
  queued: 'سجل قديم - بالانتظار', sent: 'سجل قديم - مرسلة', delivered: 'سجل قديم - تم التسليم', read: 'سجل قديم - تمت القراءة', failed: 'سجل قديم - فشل', skipped: 'سجل قديم - متخطاة', not_configured: 'سجل قديم - غير مفعّل', received: 'واردة',
};
export const WA_EVENT_LABEL: Record<string, string> = { booking_created: 'تأكيد الحجز', activated: 'تأكيد التجديد', custom: 'رسالة مخصصة', payment_confirmed: 'تأكيد الدفع', rejected: 'الرفض', inbound: 'واردة' };
export const SKIP_REASON: Record<string, string> = { auto_disabled: 'الإرسال التلقائي متوقف', no_consent: 'العميل لم يوافق على الإشعارات', template_disabled: 'القالب متوقف' };
