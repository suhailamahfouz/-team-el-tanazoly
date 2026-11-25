import { Component, effect, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { MyOrder, Page, STATUS_LABEL } from '../core/models';
import { ToastService, fmt, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { AccountService } from '../core/account';

@Component({
  selector: 'app-orders', standalone: true, imports: [ReactiveFormsModule, RouterLink, StatusComponent],
  template: `<div class="container section" style="max-width:640px">
  <h1 style="font-size:1.7rem">طلباتي</h1>
  @if (account.user(); as user) {
    @if (user.phone) { <p class="muted">الطلبات المرتبطة بحسابك على الرقم <span dir="ltr">{{ user.phone }}</span>.</p>
      @if (mine(); as list) {
        <div class="stack order-list">@for (item of list.items; track item.bookingId) {
          <button class="card order-item" type="button" (click)="openOrder(item)"><span><b dir="ltr">{{ item.bookingId }}</b><small>{{ item.networkName }} · {{ item.packageName }}</small><small>{{ fmtDate(item.createdAt) }}</small></span><app-status [value]="item.status" /></button>
        } @empty { <div class="card muted">مفيش طلبات مرتبطة بالحساب لسه.</div> }</div>
        @if (list.pages > 1) { <div class="row between" style="margin-top:12px"><button class="btn ghost sm" [disabled]="list.page <= 1 || mineLoading()" (click)="loadMine(list.page - 1)">السابق</button><span>{{ list.page }} / {{ list.pages }}</span><button class="btn ghost sm" [disabled]="list.page >= list.pages || mineLoading()" (click)="loadMine(list.page + 1)">التالي</button></div> }
      } @else if (mineError()) { <div class="card"><p class="muted">تعذر تحميل الطلبات.</p><button class="btn ghost sm" (click)="loadMine(1)">حاول مرة أخرى</button></div> }
      @else { <p class="muted">جاري تحميل الطلبات...</p> }
    } @else { <p class="muted">حسابك القديم مسجل بالبريد. تقدر تتابع طلبك برقم الطلب ورقم الموبايل.</p> }
  } @else if (!account.restoring()) { <p class="muted"><a routerLink="/login" class="account-link">سجّل الدخول</a> لعرض الطلبات المرتبطة بحسابك، أو تابع الطلب يدويًا.</p> }
  <h2 class="lookup-title">متابعة أو إضافة طلب سابق</h2><p class="muted">اكتب رقم الطلب ورقم الموبايل المسجل فيه.</p>
  <form class="card stack" [formGroup]="f" (ngSubmit)="go()">
    <div class="field"><label>رقم الطلب</label><input formControlName="bookingId" placeholder="TT-XXXXXXX" dir="ltr" autocapitalize="characters"></div>
    <div class="field"><label>رقم الموبايل المسجل</label><input formControlName="phone" inputmode="tel" placeholder="010XXXXXXXX" dir="ltr"></div>
    <button class="btn gold block" [disabled]="f.invalid || loading()">@if (loading()) { <span class="spinner"></span> } تتبع الطلب</button>
  </form>
  @if (o(); as x) {
    <div class="card stack" style="margin-top:16px">
      <div class="row between"><b dir="ltr">{{ x.bookingId }}</b><app-status [value]="x.status" /></div>
      <div class="muted">{{ x.networkName }} · {{ x.packageName }} · <b class="gold">{{ x.price == null ? 'السعر قيد التأكيد' : fmt(x.price) + ' جنيه' }}</b></div>
      <div class="muted small">رقم التجديد: <span dir="ltr">{{ x.renewalPhone }}</span></div>
      @if (x.firstTimeFee) { <div>رسوم أول مرة: {{ x.firstTimeFee }}</div> }
      @if (x.priceNote) { <div class="muted small">{{ x.priceNote }}</div> }
      @if (x.rejectionReason) { <div class="badge bad" style="white-space:normal">سبب الرفض: {{ x.rejectionReason }}</div> }
      @if (account.user()?.phone) { <button class="btn ghost sm" [disabled]="linking()" (click)="linkCurrent()">{{ linking() ? 'جاري الإضافة...' : 'إضافة الطلب لحسابي' }}</button> }
      @if (x.status === 'pending') { <p class="muted">هنراجع صلاحية العرض للخط قبل طلب الدفع.</p> }
      @if (x.status === 'awaiting_payment') {
        <div class="payment-box"><h2>تمت مراجعة العرض — مستني الدفع</h2>
          @if (x.paymentMethods?.length) {
            <p class="muted">اختار وسيلة الدفع، وحوّل المبلغ وارفع إثبات الدفع للمراجعة.</p>
            <div class="field"><label for="method">طريقة الدفع</label><select id="method" [value]="method()" (change)="method.set($any($event.target).value)"><option value="">اختار طريقة الدفع</option>@for (m of x.paymentMethods; track m.key) { <option [value]="m.key">{{ m.label }}</option> }</select></div>
            @for (m of x.paymentMethods; track m.key) { @if (m.key === method()) { <p><b>{{ m.label }}:</b> <span dir="ltr">{{ m.accountNumber }}</span> {{ m.accountName }}<br>{{ m.instructions }}</p> } }
            <div class="field"><label for="receipt">إثبات الدفع (صورة أو PDF، حتى 5 ميجا)</label><input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="pickReceipt($event)"></div>
            <button class="btn gold block" [disabled]="!method() || !receipt() || sending()" (click)="pay()">{{ sending() ? 'جاري الرفع...' : 'إرسال إثبات الدفع' }}</button>
          } @else { <p class="muted">بيانات الدفع لسه غير متاحة. تواصل معنا للمساعدة.</p> }
        </div>
      }
      @if (x.status === 'payment_review') { <p class="muted">استلمنا إثبات الدفع ومستني مراجعة المسؤولة.</p> }
      <ul class="timeline">@for (h of x.history.slice().reverse(); track h.at) { <li><b>{{ label(h.status) }}</b><div class="muted small">{{ fmtDate(h.at) }}</div></li> }</ul>
    </div>
  }</div>`,
  styles: [`.small{font-size:.85rem}.payment-box{padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--surface-1)}.payment-box .field,.payment-box p{margin-bottom:12px}.payment-box h2{font-size:1.1rem}.lookup-title{font-size:1.15rem;margin:28px 0 5px}.account-link{color:var(--purple-600);font-weight:800}.order-item{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:start;cursor:pointer;color:var(--text)}.order-item>span:first-child{display:grid;gap:4px}.order-item small{color:var(--muted)}.order-item:hover{border-color:var(--purple-400)}`],
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiService); private fb = inject(FormBuilder); private toast = inject(ToastService); private route = inject(ActivatedRoute); account = inject(AccountService);
  fmt = fmt; fmtDate = fmtDate; label = (s: string) => STATUS_LABEL[s] || s;
  loading = signal(false); o = signal<any>(null); trackedPhone = signal(''); method = signal(''); receipt = signal<File | null>(null); sending = signal(false); mine = signal<Page<MyOrder> | null>(null); mineLoading = signal(false); mineError = signal(false); linking = signal(false);
  f = this.fb.nonNullable.group({ bookingId: ['', [Validators.required, Validators.pattern(/^TT-[A-Za-z0-9]{7}$/)]], phone: ['', [Validators.required, Validators.pattern(/^(\+?20|0020|0)?1[0125]\d{8}$/)]] });
  constructor() { effect(() => { const user = this.account.user(); this.mine.set(null); this.mineError.set(false); this.o.set(null); if (user?.phone) { if (!this.f.controls.phone.value) this.f.patchValue({ phone: user.phone }); this.loadMine(1); } }, { allowSignalWrites: true }); }
  ngOnInit() { const id = this.route.snapshot.queryParamMap.get('id'); if (id) this.f.patchValue({ bookingId: id }); }
  loadMine(page: number) { const accountId = this.account.user()?.id; if (!accountId) return; this.mineLoading.set(true); this.mineError.set(false); this.api.myOrders(page).subscribe({ next: r => { if (this.account.user()?.id === accountId) { this.mine.set(r); this.mineLoading.set(false); } }, error: e => { if (this.account.user()?.id === accountId) { this.mineLoading.set(false); this.mineError.set(true); this.toast.err(e); } } }); }
  openOrder(item: MyOrder) { const phone = this.account.user()?.phone; if (!phone) return; this.f.patchValue({ bookingId: item.bookingId, phone }); this.go(); }
  linkCurrent() { const order = this.o(); if (!order || this.linking()) return; this.linking.set(true); this.api.linkOrder(order.bookingId, this.trackedPhone()).subscribe({ next: () => { this.linking.set(false); this.toast.ok('اتضاف الطلب لحسابك'); this.loadMine(1); }, error: e => { this.linking.set(false); this.toast.err(e); } }); }
  go() {
    this.loading.set(true); this.o.set(null); this.method.set(''); this.receipt.set(null); const { bookingId, phone } = this.f.getRawValue(); const accountId = this.account.user()?.id;
    this.api.track(bookingId, phone).subscribe({ next: r => { if (this.account.user()?.id === accountId) { this.trackedPhone.set(phone); this.o.set(r); } this.loading.set(false); }, error: e => { this.loading.set(false); this.toast.err(e); } });
  }
  pickReceipt(event: Event) { this.receipt.set((event.target as HTMLInputElement).files?.[0] || null); }
  pay() {
    const file = this.receipt(); const order = this.o(); if (!order || !file || !this.method() || this.sending()) return;
    if (file.size > 5 * 1024 * 1024) { this.toast.show('حجم الملف أكبر من 5 ميجا', 'err'); return; }
    const body = new FormData(); body.append('bookingId', order.bookingId); body.append('phone', this.trackedPhone()); body.append('paymentMethod', this.method()); body.append('receipt', file);
    const bookingId = order.bookingId; const phone = this.trackedPhone();
    this.sending.set(true); this.api.submitPayment(body).subscribe({ next: () => { this.sending.set(false); this.receipt.set(null); this.toast.ok('تم إرسال إثبات الدفع للمراجعة'); this.f.patchValue({ bookingId, phone }); this.go(); }, error: e => { this.sending.set(false); this.toast.err(e); } });
  }
}
