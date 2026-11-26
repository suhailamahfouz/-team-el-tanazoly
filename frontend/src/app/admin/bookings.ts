import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Booking, Network, Page, STATUS_LABEL, WA_EVENT_LABEL, Transfer, WaMessage } from '../core/models';
import { ToastService, fmt, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-bookings', standalone: true, imports: [FormsModule, StatusComponent, IconComponent],
  template: `<h1 style="font-size:1.6rem">الحجوزات</h1>
  <div class="grid filters">
    <input placeholder="اسم / موبايل / رقم الطلب" [(ngModel)]="q" (keyup.enter)="load(1)">
    <select [(ngModel)]="status" (ngModelChange)="load(1)"><option value="">كل الحالات</option>@for (s of statuses; track s) { <option [value]="s">{{ L[s] }}</option> }</select>
    <select [(ngModel)]="network" (ngModelChange)="load(1)"><option value="">كل الشبكات</option>@for (n of nets(); track n._id) { <option [value]="n._id">{{ n.nameAr }}</option> }</select>
    <input type="date" [(ngModel)]="from" (ngModelChange)="load(1)" title="من"><input type="date" [(ngModel)]="to" (ngModelChange)="load(1)" title="إلى">
    <button class="btn sm" (click)="load(1)">بحث</button>
  </div>
  <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الشبكة</th><th>الباقة</th><th>السعر</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
    @for (b of data()?.items; track b._id) { <tr class="click" (click)="open(b._id)"><td dir="ltr">{{ b.bookingId }}</td><td>{{ b.customerName }}<div class="muted small" dir="ltr">{{ b.customerPhone }}</div></td><td>{{ b.networkName }}</td><td>{{ b.packageSnapshot.name }}</td><td>{{ fmt(b.price) }}</td><td><app-status [value]="b.status" /></td><td>{{ fmtDate(b.createdAt) }}</td></tr> }
    @empty { <tr><td colspan="7" class="empty">لا توجد حجوزات</td></tr> }</tbody></table></div>
  @if (data(); as d) { <div class="row between" style="margin-top:12px"><span class="muted">{{ d.total }} حجز</span><div class="row"><button class="btn ghost sm" [disabled]="d.page <= 1" (click)="load(d.page - 1)"><app-icon name="chevronRight" [size]="15" /> السابق</button><span>{{ d.page }} / {{ d.pages || 1 }}</span><button class="btn ghost sm" [disabled]="d.page >= d.pages" (click)="load(d.page + 1)">التالي <app-icon name="chevronLeft" [size]="15" /></button></div></div> }

  @if (sel(); as b) {
    <div class="modal-bg" (click)="close()"><div class="modal" (click)="$event.stopPropagation()">
      <div class="row between"><h2 style="margin:0" dir="ltr">{{ b.bookingId }}</h2><app-status [value]="b.status" /></div>
      <div class="row between"><h3>بيانات الطلب</h3><button class="btn ghost sm" (click)="beginEdit(b)"><app-icon name="pencil" [size]="15" /> تعديل البيانات</button></div>
      <div class="order-details-grid"><div class="order-fields">
      @if (editing()) { <div class="edit-grid">
        <label class="field">اسم العميل<input [(ngModel)]="draft.customerName"></label>
        <label class="field">رقم العميل<input [(ngModel)]="draft.customerPhone" dir="ltr"></label>
        <label class="field">رقم التجديد<input [(ngModel)]="draft.renewalPhone" dir="ltr"></label>
        <label class="field">الشبكة<input [(ngModel)]="draft.networkName"></label>
        <label class="field">اسم الباقة<input [(ngModel)]="draft.packageName"></label>
        <label class="field">السعر<input type="number" min="0" [(ngModel)]="draft.price"></label>
        <label class="field">طريقة الدفع<input [(ngModel)]="draft.paymentMethod"></label>
        @if (b.status === 'rejected') { <label class="field">سبب الرفض<input [(ngModel)]="draft.rejectionReason"></label> }
        <div class="row" style="grid-column:1/-1"><button class="btn gold sm" [disabled]="busy()" (click)="saveEdit(b)"><app-icon name="save" [size]="15" /> حفظ التعديلات</button><button class="btn ghost sm" (click)="editing.set(false)">إلغاء</button></div>
      </div> } @else {
        <dl><dt>العميل</dt><dd>{{ b.customerName }}</dd><dt>موبايل العميل</dt><dd dir="ltr">{{ b.customerPhone }}</dd><dt>رقم التجديد</dt><dd dir="ltr">{{ b.renewalPhone }}</dd>
          <dt>الشبكة / الباقة</dt><dd>{{ b.networkName }} · {{ b.packageSnapshot.name }}</dd><dt>السعر</dt><dd class="gold">{{ fmt(b.price) }} جنيه</dd>
          <dt>طريقة الدفع</dt><dd>{{ b.paymentMethod }} ({{ b.payment?.status }})</dd><dt>التاريخ</dt><dd>{{ fmtDate(b.createdAt) }}</dd>
          @if (b.rejectionReason) { <dt>سبب الرفض</dt><dd>{{ b.rejectionReason }}</dd> }</dl>
      }
      </div><section class="receipt-panel" aria-label="سكرين التحويل">
        <div class="receipt-heading"><app-icon name="receipt" [size]="18" /><h4>سكرين التحويل</h4></div>
        @if (!b.payment?.receipt?.file) { <p class="muted small">لا يوجد إيصال مرفق بهذا الطلب.</p> }
        @else if (receiptLoading()) { <p class="muted small">جاري تحميل الإيصال...</p> }
        @else if (receiptError()) { <p class="muted small">تعذر تحميل الإيصال.</p><button class="btn ghost sm" type="button" (click)="loadReceipt(b._id)">حاولي مرة أخرى</button> }
        @else if (receiptUrl()) {
          @if (receiptIsPdf()) { <div class="receipt-pdf"><app-icon name="file" [size]="24" /><span>الإيصال مرفق كملف PDF</span></div> }
          @else { <a class="receipt-preview" [href]="receiptUrl()" target="_blank" rel="noopener"><img [src]="receiptUrl()" alt="صورة إيصال التحويل"></a> }
          <a class="btn ghost sm receipt-open" [href]="receiptUrl()" target="_blank" rel="noopener"><app-icon name="arrowUpRight" [size]="15" /> {{ receiptIsPdf() ? 'فتح ملف الإيصال' : 'فتح الصورة بحجم أكبر' }}</a>
        }
      </section></div>

      <h3 style="margin-top:16px">الإجراءات</h3>
      <div class="row">
        @if (b.workflow === 'review_first' && b.status === 'pending') { <button class="btn gold sm" [disabled]="busy()" (click)="act(b, 'approve', 'هل تأكدتِ من صلاحية العرض لهذا الرقم؟')">تأكيد صلاحية العرض وطلب الدفع</button> }
        @if (can(b, 'payment_confirmed')) { <button class="btn ok sm" [disabled]="busy()" (click)="act(b, 'confirm-payment', b.workflow === 'payment_first' ? 'هل راجعتِ صلاحية العرض للرقم وتأكدتِ من استلام الدفع؟' : 'تأكيد استلام الدفع؟')"><app-icon name="circleCheck" [size]="16" /> {{ b.workflow === 'payment_first' ? 'تأكيد العرض والدفع' : 'تأكيد الدفع' }}</button> }
        @if (b.workflow !== 'review_first' && b.status === 'pending' && can(b, 'payment_review')) { <button class="btn ghost sm" [disabled]="busy()" (click)="act(b, 'review')">مراجعة الدفع</button> }
        @if (b.status === 'payment_confirmed') { <button class="btn ghost sm" [disabled]="busy()" (click)="act(b, 'processing')"><app-icon name="refresh" [size]="16" /> جاري التنفيذ</button> }
        @if (b.status === 'payment_confirmed' || b.status === 'processing') { <button class="btn gold sm" [disabled]="busy()" (click)="act(b, 'activate', 'هل تم تجديد الباقة فعلياً؟')"><app-icon name="circleCheck" [size]="16" /> تأكيد التجديد</button> }
        @if (can(b, 'cancelled')) { <button class="btn ghost sm" [disabled]="busy()" (click)="act(b, 'cancel', 'إلغاء الطلب؟')">إلغاء</button> }
        @if (can(b, 'rejected')) { <button class="btn danger sm" (click)="rejecting.set(!rejecting())"><app-icon name="circleX" [size]="16" /> رفض</button> }
        <button class="btn ghost sm" [disabled]="busy()" (click)="beginWhatsApp(b)"><app-icon name="message" [size]="16" /> رسالة واتساب جاهزة للعميل</button>
      </div>
      @if (rejecting()) { <div class="row" style="margin-top:10px"><input class="grow" placeholder="سبب الرفض (يُرسل للعميل)" [(ngModel)]="reason"><button class="btn danger sm" [disabled]="reason.trim().length < 3 || busy()" (click)="act(b, 'reject', '', { reason })">تأكيد الرفض</button></div> }
      @if (['activated','rejected','cancelled'].includes(b.status)) { <p class="muted small">الطلب في حالة نهائية.</p> }

      @if (waEditor()) { <div class="wa-editor">
        <h3>رسالة واتساب للعميل</h3>
        <p class="muted small">إلى رقم واتساب العميل: <span dir="ltr">{{ b.customerPhone }}</span></p>
        <label class="field">الرسالة الجاهزة — تقدري تعدليها<textarea rows="8" maxlength="4096" [(ngModel)]="waBody"></textarea></label>
        <p class="muted small">هيتفتح واتساب بالرسالة؛ راجعيها واضغطي إرسال بنفسك. فتح المحادثة لا يعني إرسالها.</p>
        <div class="row"><button class="btn gold sm" [disabled]="!waBody.trim() || busy()" (click)="launchWhatsApp(b)"><app-icon name="arrowUpRight" [size]="15" /> فتح الرسالة في واتساب</button><button class="btn ghost sm" (click)="waEditor.set(false)">إلغاء</button></div>
      </div> }

      <section class="transfer-section"><div class="row between"><h3>التحويلات</h3><button class="btn ghost sm" (click)="transferForm.set(!transferForm())"><app-icon name="plus" [size]="15" /> تسجيل تحويل</button></div>
        @if (transferForm()) { <div class="edit-grid">
          <label class="field">المبلغ<input type="number" min="0" [(ngModel)]="transferDraft.amount"></label>
          <label class="field">طريقة الدفع<select [(ngModel)]="transferDraft.method"><option value="vodafone_cash">Vodafone Cash</option><option value="instapay">InstaPay</option><option value="other">وسيلة أخرى</option></select></label>
          <label class="field">رقم مرجعي<input [(ngModel)]="transferDraft.reference"></label>
          <label class="field">ملاحظة<input [(ngModel)]="transferDraft.note"></label>
          <label class="field receipt-pick">الإيصال (اختياري)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="pickTransferReceipt($event)"></label>
          <div class="row" style="grid-column:1/-1"><button class="btn gold sm" [disabled]="busy() || transferDraft.amount == null" (click)="createTransfer(b)">حفظ التحويل</button><button class="btn ghost sm" (click)="transferForm.set(false)">إلغاء</button></div>
        </div> }
        @for (t of b.transfers || []; track t._id) { <div class="transfer-row"><div class="transfer-main"><b>{{ fmt(t.amount) }} جنيه · {{ paymentLabel(t.method) }}</b><span class="muted small">مرجع: {{ t.reference || '—' }} · {{ fmtDate(t.createdAt) }} · {{ t.createdBy }}</span>@if (t.note) { <span class="muted small">{{ t.note }}</span> }@if (t.receipt?.file) { <button class="text-action" (click)="viewTransferReceipt(t)"><app-icon name="file" [size]="14" /> عرض الإيصال</button> }</div>
          <div class="transfer-review"><app-status [value]="t.status" />@if (t.status === 'pending') { <button class="btn ok sm" (click)="reviewTransfer(b,t,'confirmed')">تأكيد</button><button class="btn danger sm" (click)="reviewTransfer(b,t,'rejected')">رفض</button> }</div></div> } @empty { @if (!transferForm()) { <div class="muted small">لا توجد تحويلات مسجلة.</div> } }
      </section>

      <section class="whatsapp-section"><h3>سجل رسائل واتساب</h3>
        @for (m of b.messages; track m._id) { <div class="note"><div class="row between"><b>{{ W[m.event] || m.event }}</b><app-status [value]="m.status" /></div><div class="muted small">إلى {{ m.recipientType === 'renewal' ? 'رقم التجديد' : 'رقم العميل' }} · {{ m.to }}</div><p class="message-body">{{ m.body }}</p><div class="muted small">@if (m.openedAt) { فُتح واتساب: {{ fmtDate(m.openedAt) }} } @else { سُجلت: {{ fmtDate(m.createdAt) }} } @if (m.manuallyConfirmedAt) { · أكده {{ m.manuallyConfirmedBy }} في {{ fmtDate(m.manuallyConfirmedAt) }} }</div>@if (m.status === 'opened') { <button class="btn ok sm" (click)="confirmWhatsApp(b,m)"><app-icon name="circleCheck" [size]="15" /> تأكيد الإرسال يدويًا</button> }</div> } @empty { <div class="muted small">لا توجد رسائل مسجلة لهذا الطلب.</div> }
      </section>

      <h3 style="margin-top:16px">ملاحظات داخلية</h3>
      @for (n of b.adminNotes; track n.at) { <div class="note">{{ n.text }}<span class="muted small"> — {{ n.by }}</span></div> }
      <div class="row"><input class="grow" placeholder="أضف ملاحظة..." [(ngModel)]="note"><button class="btn ghost sm" [disabled]="!note.trim()" (click)="addNote(b)">إضافة</button></div>

      <h3 style="margin-top:16px">سجل الحالات</h3>
      <ul class="timeline">@for (h of b.statusHistory.slice().reverse(); track h.at) { <li><b>{{ L[h.status] }}</b> <span class="muted small">{{ fmtDate(h.at) }} · {{ h.by }}</span>@if (h.note) { <div class="muted small">{{ h.note }}</div> }</li> }</ul>
      <h3 style="margin-top:16px">سجل التعديلات</h3>
      @for (entry of b.auditTrail || []; track entry.at) { <div class="note"><b>{{ auditLabel(entry.action) }}</b><span class="muted small"> — {{ fmtDate(entry.at) }} · {{ entry.by }}</span>@for (change of entry.changes; track change.field) { <div class="muted small">{{ change.field }}: {{ displayValue(change.before) }} ← {{ displayValue(change.after) }}</div> }</div> } @empty { <div class="muted small">لا توجد تعديلات مسجلة.</div> }
      <button class="btn ghost block" (click)="close()">إغلاق</button>
    </div></div>
  }`,
  styles: [`.filters{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))} .small{font-size:.82rem}
  dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;dt{color:var(--muted)}dd{margin:0;font-weight:600}} .note{padding:10px 12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px}
  .order-details-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,240px);gap:18px;align-items:start;margin:8px 0 18px}.order-fields{min-width:0}.order-fields dl{overflow-wrap:anywhere}.receipt-panel{min-width:0;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface-1)}.receipt-heading{display:flex;align-items:center;gap:8px;margin-bottom:10px}.receipt-heading app-icon{color:var(--purple-400)}.receipt-heading h4{margin:0;font-size:.95rem}.receipt-panel p{margin:0}.receipt-preview{display:block;overflow:hidden;border-radius:10px;background:rgba(0,0,0,.04)}.receipt-preview img{display:block;width:100%;max-height:230px;object-fit:contain}.receipt-open{width:100%;margin-top:10px;white-space:normal;text-align:center}.receipt-pdf{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.85rem}
  .edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface-1)}
  .edit-grid .field{font-size:.82rem}.transfer-section,.whatsapp-section{margin-top:20px;padding-top:14px;border-top:1px solid var(--line)}
  .transfer-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.transfer-main{display:grid;gap:4px}.transfer-review{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .wa-editor{display:grid;gap:10px;margin-top:12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--surface-1)}.wa-editor p{margin:0}.message-body{white-space:pre-wrap;margin:8px 0}.text-action{display:inline-flex;align-items:center;gap:5px;width:max-content;padding:0;border:0;background:none;color:var(--purple-300);cursor:pointer;font:inherit;font-size:.82rem}
  @media(max-width:600px){.order-details-grid{grid-template-columns:minmax(0,1fr);gap:12px}.receipt-preview img{max-height:300px}.transfer-row{flex-direction:column}.transfer-review{width:100%}.transfer-review .badge{margin-inline-end:auto}}`],
})
export class AdminBookingsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService); private toast = inject(ToastService);
  fmt = fmt; fmtDate = fmtDate; L = STATUS_LABEL; W = WA_EVENT_LABEL; statuses = Object.keys(STATUS_LABEL);
  q = ''; status = ''; network = ''; from = ''; to = ''; nets = signal<Network[]>([]); data = signal<Page<Booking> | null>(null);
  sel = signal<Booking | null>(null); receiptUrl = signal(''); receiptIsPdf = signal(false); receiptLoading = signal(false); receiptError = signal(false); busy = signal(false); rejecting = signal(false); reason = ''; note = ''; private openVersion = 0; private receiptVersion = 0;
  editing = signal(false); draft: any = {};
  transferForm = signal(false); transferDraft: { amount: number | null; method: string; reference: string; note: string } = { amount: null, method: 'vodafone_cash', reference: '', note: '' }; transferReceiptFile: File | null = null;
  waEditor = signal(false); waRecipient: 'customer' | 'renewal' = 'customer'; waEvent: 'booking_created' | 'activated' | 'custom' = 'custom'; waBody = '';
  ngOnInit() { this.api.adminNetworks().subscribe(n => this.nets.set(n)); this.load(1); }
  load(page: number) { this.api.bookings({ q: this.q, status: this.status, network: this.network, from: this.from, to: this.to, page }).subscribe(d => this.data.set(d)); }
  open(id: string) {
    const version = ++this.openVersion; this.clearReceipt(); this.sel.set(null); this.rejecting.set(false); this.reason = ''; this.note = ''; this.editing.set(false); this.waEditor.set(false); this.transferForm.set(false);
    this.api.booking(id).subscribe({ next: b => { if (version !== this.openVersion) return; this.sel.set(b); if (b.payment?.receipt?.file) this.loadReceipt(id); }, error: e => { if (version === this.openVersion) this.toast.err(e); } });
  }
  loadReceipt(id: string) { const version = ++this.receiptVersion; this.clearReceiptUrl(); this.receiptError.set(false); this.receiptLoading.set(true); this.api.receipt(id).subscribe({ next: blob => { if (version !== this.receiptVersion || this.sel()?._id !== id) return; this.receiptIsPdf.set(blob.type === 'application/pdf'); this.receiptUrl.set(URL.createObjectURL(blob)); this.receiptLoading.set(false); }, error: () => { if (version === this.receiptVersion && this.sel()?._id === id) { this.receiptLoading.set(false); this.receiptError.set(true); } } }); }
  private clearReceiptUrl() { const url = this.receiptUrl(); if (url) URL.revokeObjectURL(url); this.receiptUrl.set(''); }
  private clearReceipt() { this.receiptVersion++; this.clearReceiptUrl(); this.receiptIsPdf.set(false); this.receiptLoading.set(false); this.receiptError.set(false); }
  close() { this.openVersion++; this.clearReceipt(); this.sel.set(null); }
  ngOnDestroy() { this.close(); }
  can(b: Booking, to: string) { if (b.workflow === 'review_first' && b.status === 'pending' && ['payment_review', 'payment_confirmed'].includes(to)) return false; return ({ pending: ['payment_review', 'payment_confirmed', 'rejected', 'cancelled'], awaiting_payment: ['rejected', 'cancelled'], payment_review: ['payment_confirmed', 'rejected', 'cancelled'], payment_confirmed: ['processing', 'activated', 'rejected', 'cancelled'], processing: ['activated', 'rejected'] } as Record<string, string[]>)[b.status]?.includes(to) ?? false; }
  act(b: Booking, action: string, confirmMsg = '', body: object = {}) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    this.busy.set(true);
    this.api.action(b._id, action, body).subscribe({
      next: () => { this.busy.set(false); this.toast.ok('تم تحديث حالة الطلب. يمكنك فتح واتساب يدويًا عند الحاجة.'); this.load(this.data()?.page || 1); setTimeout(() => this.open(b._id), 450); },
      error: e => { this.busy.set(false); this.toast.err(e); },
    });
  }
  addNote(b: Booking) { this.api.addNote(b._id, this.note).subscribe({ next: () => { this.note = ''; this.open(b._id); }, error: e => this.toast.err(e) }); }
  beginEdit(b: Booking) {
    this.draft = { customerName: b.customerName, customerPhone: b.customerPhone, renewalPhone: b.renewalPhone, packageName: b.packageSnapshot.name, networkName: b.networkName, price: b.price, ...(b.paymentMethod ? { paymentMethod: b.paymentMethod } : {}), rejectionReason: b.rejectionReason || '' };
    this.editing.set(true);
  }
  saveEdit(b: Booking) {
    this.busy.set(true);
    const body = { ...this.draft }; if (!body.paymentMethod) delete body.paymentMethod; if (body.price == null || body.price === '') delete body.price;
    this.api.updateBooking(b._id, body).subscribe({ next: () => { this.busy.set(false); this.toast.ok('تم حفظ التعديلات وتسجيلها في سجل الطلب'); this.load(this.data()?.page || 1); this.open(b._id); }, error: e => { this.busy.set(false); this.toast.err(e); } });
  }
  paymentLabel(method: string) { return ({ vodafone_cash: 'Vodafone Cash', instapay: 'InstaPay', other: 'وسيلة أخرى' } as Record<string, string>)[method] || method; }
  pickTransferReceipt(event: Event) { this.transferReceiptFile = (event.target as HTMLInputElement).files?.[0] || null; }
  createTransfer(b: Booking) {
    if (this.transferDraft.amount == null) return;
    const form = new FormData();
    form.append('bookingId', b._id); form.append('amount', String(this.transferDraft.amount)); form.append('method', this.transferDraft.method);
    form.append('reference', this.transferDraft.reference); form.append('note', this.transferDraft.note);
    if (this.transferReceiptFile) form.append('receipt', this.transferReceiptFile);
    this.busy.set(true);
    this.api.createTransfer(form).subscribe({ next: () => { this.busy.set(false); this.transferForm.set(false); this.transferReceiptFile = null; this.transferDraft = { amount: null, method: 'vodafone_cash', reference: '', note: '' }; this.toast.ok('تم تسجيل التحويل'); this.open(b._id); }, error: e => { this.busy.set(false); this.toast.err(e); } });
  }
  reviewTransfer(b: Booking, transfer: Transfer, status: 'confirmed' | 'rejected') {
    const promptText = status === 'confirmed' ? 'تأكيد استلام هذا التحويل؟' : 'رفض هذا التحويل؟';
    if (!confirm(promptText)) return;
    this.api.reviewTransfer(transfer._id, status).subscribe({ next: () => { this.toast.ok(status === 'confirmed' ? 'تم تأكيد التحويل وتحديث الطلب' : 'تم رفض التحويل'); this.open(b._id); this.load(this.data()?.page || 1); }, error: e => this.toast.err(e) });
  }
  viewTransferReceipt(transfer: Transfer) {
    this.api.transferReceipt(transfer._id).subscribe(blob => window.open(URL.createObjectURL(blob), '_blank', 'noopener'));
  }
  beginWhatsApp(b: Booking) {
    this.waEvent = b.status === 'activated' ? 'activated' : b.status === 'pending' ? 'booking_created' : 'custom';
    this.waRecipient = 'customer';
    const statusMessage: Record<string, string> = {
      pending: 'استلمنا طلبك، وهنراجع صلاحية العرض للرقم قبل الدفع.',
      awaiting_payment: 'راجعنا طلبك. تابع الطلب على الموقع للاطلاع على بيانات الدفع عند توفرها ورفع الإثبات.',
      payment_review: 'استلمنا إثبات الدفع، وهنراجعه قبل بدء التنفيذ.',
      payment_confirmed: 'تم تأكيد الدفع، وطلبك جاري التنفيذ.',
      processing: 'طلبك جاري التنفيذ، وهنبلغك بعد تأكيد التجديد.',
      activated: 'تم تجديد الباقة بنجاح.',
      rejected: `للأسف لم نتمكن من إكمال الطلب.${b.rejectionReason ? ` السبب: ${b.rejectionReason}` : ''}`,
      cancelled: 'تم إلغاء الطلب.',
    };
    const greeting = b.customerName && b.customerName !== 'عميل' ? `أهلاً ${b.customerName}` : 'أهلاً بيك';
    const price = b.price == null ? 'السعر: قيد التأكيد' : `السعر: ${fmt(b.price)} جنيه`;
    this.waBody = `${greeting}، معاك تيم النزلاوي.\n\n${statusMessage[b.status] || 'تواصل معنا بخصوص طلبك.'}\n\nرقم الطلب: ${b.bookingId}\nالباقة: ${b.packageSnapshot.name}\nرقم الخط: ${b.renewalPhone}\n${price}\n\nتقدر تتابع الطلب من الموقع برقم الطلب ورقم واتسابك.`;
    this.waEditor.set(true);
  }
  launchWhatsApp(b: Booking) {
    const target = this.waRecipient === 'customer' ? b.customerPhone : b.renewalPhone;
    const popup = window.open('about:blank', '_blank');
    if (!popup) { this.toast.err({ error: { message: 'اسمحي بفتح النوافذ المنبثقة لفتح واتساب.' } }); return; }
    this.busy.set(true);
    this.api.prepareWhatsApp(b._id, { recipientType: this.waRecipient, to: target, body: this.waBody.trim(), event: this.waEvent }).subscribe({
      next: message => {
        const international = message.to.startsWith('0') ? `2${message.to}` : message.to;
        popup.location.href = `https://wa.me/${international}?text=${encodeURIComponent(message.body)}`;
        this.api.markWhatsAppOpened(message._id).subscribe({ next: () => { this.busy.set(false); this.waEditor.set(false); this.toast.ok('تم فتح واتساب وسُجّل وقت الفتح فقط؛ أكدي الإرسال بعد الإرسال يدويًا.'); this.open(b._id); }, error: e => { this.busy.set(false); this.toast.err(e); this.open(b._id); } });
      },
      error: e => { this.busy.set(false); popup.close(); this.toast.err(e); },
    });
  }
  confirmWhatsApp(b: Booking, message: WaMessage) {
    if (!confirm('هل أرسلتِ الرسالة فعليًا من واتساب؟')) return;
    this.api.confirmWhatsAppSent(message._id).subscribe({ next: () => { this.toast.ok('تم تسجيل تأكيد الإرسال اليدوي'); this.open(b._id); }, error: e => this.toast.err(e) });
  }
  auditLabel(action: string) { return ({ updated: 'تعديل بيانات الطلب', transfer_added: 'تسجيل تحويل', transfer_reviewed: 'مراجعة تحويل' } as Record<string, string>)[action] || action; }
  displayValue(value: unknown) { return value == null ? '—' : typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value); }
}
