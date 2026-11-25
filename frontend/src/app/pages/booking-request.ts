import { Component, effect, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Pkg } from '../core/models';
import { ToastService, fmt } from '../core/ui';
import { AccountService } from '../core/account';

@Component({
  selector: 'app-booking-request', standalone: true, imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="container section" style="max-width:680px">
    @if (done(); as result) {
      <div class="card center stack"><h1>تم استلام طلبك</h1><p>رقم طلبك، احتفظ به للمتابعة:</p>
        <strong class="order-number" dir="ltr">{{ result.bookingId }}</strong>
        <p>حالة الطلب: مستني المراجعة. هنتأكد من صلاحية العرض للرقم قبل طلب الدفع.</p>
        @if (result.linkedToAccount) { <p class="muted">الطلب اتضاف لحسابك وتقدر تتابعه من طلباتي.</p> }
        @else if (account.user()?.phone) { <p class="muted">الطلب مش مرتبط بالحساب لأن رقم واتساب الطلب مختلف عن رقم الحساب.</p> }
        <a class="btn gold block" routerLink="/orders" [queryParams]="{ id: result.bookingId }">متابعة الطلب</a>
      </div>
    } @else {
      <h1>اطلب التجديد</h1><p class="muted">من غير حساب. هنراجع صلاحية العرض قبل الدفع.</p>
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
          <p class="muted small">بعد المراجعة هتظهر لك طريقة الدفع في صفحة متابعة الطلب. لن يُطلب منك الدفع الآن.</p>
          <button class="btn gold block" [disabled]="form.invalid || sending()">{{ sending() ? 'جاري إرسال الطلب...' : 'إرسال طلب التجديد' }}</button>
        </form>
      } @else {
        <div class="card center"><p>اختار الباقة من الصفحة الرئيسية أولًا.</p><a class="btn gold" routerLink="/">اختار الباقة</a></div>
      }
    }
  </div>`,
  styles: [`.selected{border-inline-start:4px solid var(--purple-600);margin-top:18px}.selected p{margin:3px 0}.change{display:inline-block;margin-top:10px;color:var(--purple-600);font-weight:700}.order-number{display:inline-block;font-size:1.6rem;color:var(--purple-600);letter-spacing:.08em}.small{font-size:.88rem}`],
})
export class BookingRequestComponent implements OnInit {
  private api = inject(ApiService); private route = inject(ActivatedRoute); private fb = inject(FormBuilder); private toast = inject(ToastService); account = inject(AccountService);
  selected = signal<Pkg | null>(null); sending = signal(false); done = signal<{bookingId: string; linkedToAccount: boolean} | null>(null); fmt = fmt;
  form = this.fb.nonNullable.group({ renewalPhone: ['', [Validators.required, Validators.minLength(8)]], customerPhone: ['', [Validators.required, Validators.pattern(/^(\+?20|0020|0)?1[0125]\d{8}$/)]] });
  constructor() { effect(() => { const phone = this.account.user()?.phone; if (phone && !this.form.controls.customerPhone.value) this.form.patchValue({ customerPhone: phone }); }); }
  ngOnInit() { const id = this.route.snapshot.queryParamMap.get('package'); if (id) this.api.package(id).subscribe({ next: p => { if (p.isBookable) this.selected.set(p); else this.toast.show('الباقة غير متاحة للطلب', 'err'); }, error: e => this.toast.err(e) }); }
  submit() { const p = this.selected(); if (!p || this.form.invalid || this.sending()) return; this.sending.set(true); this.api.createBooking({ packageId: p._id, ...this.form.getRawValue() }).subscribe({ next: r => { this.done.set(r); this.sending.set(false); window.scrollTo({ top: 0 }); }, error: e => { this.sending.set(false); this.toast.err(e); } }); }
}
