import { Component, effect, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { PaymentMethod, Pkg } from '../core/models';
import { ToastService, fmt } from '../core/ui';
import { AccountService } from '../core/account';
import { timeout } from 'rxjs';

@Component({
  selector: 'app-booking-request', standalone: true, imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="container section" style="max-width:680px">
    @if (done(); as result) {
      <div class="card center stack"><h1>تم استلام طلبك</h1><p>رقم طلبك، احتفظ به للمتابعة:</p>
        <strong class="order-number" dir="ltr">{{ result.bookingId }}</strong>
        <p>استلمنا الطلب وإثبات التحويل. هنتأكد من صلاحية العرض ونراجع الدفع، والتجديد يتأكد بعد تنفيذه.</p>
        @if (result.linkedToAccount) { <p class="muted">الطلب اتضاف لحسابك وتقدر تتابعه من طلباتي.</p> }
        @else if (account.user()?.phone) { <p class="muted">الطلب مش مرتبط بالحساب لأن رقم واتساب الطلب مختلف عن رقم الحساب.</p> }
        <a class="btn gold block" routerLink="/orders" [queryParams]="{ id: result.bookingId }">متابعة الطلب</a>
      </div>
    } @else {
      <h1>اطلب التجديد</h1><p class="muted">اكتب بياناتك وارفع إثبات التحويل. مش لازم تعمل حساب.</p>
      @if (selected(); as p) {
        <div class="card selected"><h2>{{ p.name }}</h2><p>{{ p.internetQuota }} @if (p.minutes) { · {{ p.minutes }} }</p>
          @if (p.price != null) { <strong>{{ fmt(p.price) }} جنيه</strong> } @else { <strong>سعر التفعيل غير محدد — سيتم تأكيده بعد المراجعة</strong> }
          @if (p.firstTimeFee) { <p>رسوم أول مرة: {{ p.firstTimeFee }}</p> }
          @if (p.priceNote) { <p class="muted">{{ p.priceNote }}</p> }
          <a routerLink="/" class="change">تغيير الباقة</a>
        </div>
        <form class="card stack" style="margin-top:14px" [formGroup]="form" (ngSubmit)="submit()">
          <div class="field"><label for="line">رقم الخط المطلوب تجديده</label><input id="line" type="tel" inputmode="tel" dir="ltr" formControlName="renewalPhone" placeholder="رقم الموبايل أو الأرضي"></div>
          <div class="field"><label for="whatsapp">رقم واتساب للتواصل ومتابعة الطلب</label><input id="whatsapp" type="tel" inputmode="tel" dir="ltr" formControlName="customerPhone" placeholder="01XXXXXXXXX"></div>
          <div class="field"><label for="payment">طريقة الدفع</label><select id="payment" formControlName="paymentMethod"><option value="">اختار طريقة الدفع</option>@for (m of methods(); track m.key) { <option [value]="m.key">{{ m.label }}</option> }</select></div>
          @if (method(); as m) { <div class="payment-details"><b>{{ m.label }}</b><div dir="ltr" class="account-number">{{ m.accountNumber }}</div>@if (m.accountName) { <div>{{ m.accountName }}</div> }@if (m.instructions) { <p class="muted small">{{ m.instructions }}</p> }</div> }
          @if (methodsLoading()) { <p class="muted small">جاري تحميل طرق الدفع...</p> }
          @else if (methodsError()) { <p class="muted small">تعذر تحميل طرق الدفع. <button class="retry" type="button" (click)="loadMethods()">إعادة المحاولة</button></p> }
          @else if (!methods().length) { <p class="muted small">طرق الدفع لسه غير متاحة؛ تواصل معنا قبل التحويل.</p> }
          @if (p.price == null) { <p class="muted small">سعر التفعيل غير محدد؛ تواصل معنا لتأكيده قبل التحويل وإرسال الطلب.</p> }
          <div class="field"><label for="receipt">سكرين التحويل أو إيصال الدفع</label><input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="pickReceipt($event)"><p class="muted small">صورة JPG أو PNG أو WebP أو PDF، حتى 5 ميجا.</p></div>
          <p class="muted small">إرسال الإيصال لا يعني تأكيد الدفع أو التجديد؛ المسؤولة هتراجع الطلب أولًا.</p>
          <button class="btn gold block" [disabled]="form.invalid || !file() || p.price == null || sending()">{{ sending() ? 'جاري إرسال الطلب...' : 'إرسال طلب التجديد' }}</button>
        </form>
      } @else {
        <div class="card center"><p>اختار الباقة من الصفحة الرئيسية أولًا.</p><a class="btn gold" routerLink="/">اختار الباقة</a></div>
      }
    }
  </div>`,
  styles: [`.selected{border-inline-start:4px solid var(--purple-600);margin-top:18px}.selected p{margin:3px 0}.change{display:inline-block;margin-top:10px;color:var(--purple-600);font-weight:700}.order-number{display:inline-block;font-size:1.6rem;color:var(--purple-600);letter-spacing:.08em}.small{font-size:.88rem}.payment-details{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface-1)}.payment-details p{margin:6px 0 0}.account-number{font-weight:800;text-align:start;overflow-wrap:anywhere}.retry{border:0;background:none;color:var(--purple-600);font:inherit;font-weight:800;cursor:pointer}`],
})
export class BookingRequestComponent implements OnInit {
  private api = inject(ApiService); private route = inject(ActivatedRoute); private fb = inject(FormBuilder); private toast = inject(ToastService); account = inject(AccountService);
  selected = signal<Pkg | null>(null); sending = signal(false); done = signal<{bookingId: string; linkedToAccount: boolean} | null>(null); fmt = fmt;
  methods = signal<PaymentMethod[]>([]); methodsLoading = signal(true); methodsError = signal(false); file = signal<File | null>(null);
  form = this.fb.nonNullable.group({ renewalPhone: ['', [Validators.required, Validators.minLength(8)]], customerPhone: ['', [Validators.required, Validators.pattern(/^(\+?20|0020|0)?1[0125]\d{8}$/)]], paymentMethod: ['', Validators.required] });
  constructor() { effect(() => { const phone = this.account.user()?.phone; if (phone && !this.form.controls.customerPhone.value) this.form.patchValue({ customerPhone: phone }); }); }
  ngOnInit() { this.loadMethods(); const id = this.route.snapshot.queryParamMap.get('package'); if (id) this.api.package(id).subscribe({ next: p => { if (p.isBookable) this.selected.set(p); else this.toast.show('الباقة غير متاحة للطلب', 'err'); }, error: e => this.toast.err(e) }); }
  loadMethods() { this.methodsLoading.set(true); this.methodsError.set(false); this.api.paymentMethods().pipe(timeout(8000)).subscribe({ next: m => { this.methods.set(m); this.methodsLoading.set(false); }, error: () => { this.methods.set([]); this.methodsLoading.set(false); this.methodsError.set(true); } }); }
  method() { return this.methods().find(m => m.key === this.form.controls.paymentMethod.value); }
  pickReceipt(e: Event) { const input = e.target as HTMLInputElement; const f = input.files?.[0] || null; if (f && f.size > 5 * 1024 * 1024) { this.toast.show('حجم الملف أكبر من 5 ميجا', 'err'); input.value = ''; this.file.set(null); return; } this.file.set(f); }
  submit() { const p = this.selected(); const file = this.file(); if (!p || p.price == null || !file || this.form.invalid || this.sending()) return; const values = this.form.getRawValue(); const data = new FormData(); data.append('packageId', p._id); data.append('renewalPhone', values.renewalPhone); data.append('customerPhone', values.customerPhone); data.append('paymentMethod', values.paymentMethod); data.append('quotedPrice', String(p.price)); data.append('receipt', file); this.sending.set(true); this.api.createBooking(data).subscribe({ next: r => { this.done.set(r); this.sending.set(false); window.scrollTo({ top: 0 }); }, error: e => { this.sending.set(false); this.toast.err(e); } }); }
}
