import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Network, PaymentMethod, Pkg } from '../core/models';
import { SettingsService, ToastService, fmt } from '../core/ui';
import { NetLogoComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

const PHONE = /^(\+?20|0020|0)?1[0125]\d{8}$/;

@Component({
  selector: 'app-booking', standalone: true, imports: [ReactiveFormsModule, RouterLink, NetLogoComponent, IconComponent],
  template: `<div class="container section" style="max-width:720px">
  @if (done()) {
    <div class="card center ok-card">
      <div class="success-mark"><app-icon name="circleCheck" [size]="34" /></div><h2>تم استلام طلبك</h2>
      <p class="muted">رقم طلبك (احتفظ به لمتابعة الطلب):</p>
      <div class="bid" (click)="copy(done()!.bookingId)">{{ done()!.bookingId }}</div>
      <p>{{ done()!.packageName }} · <b class="gold">{{ fmt(done()!.price) }} جنيه</b></p>
      <p class="muted small">طلبك تحت مراجعة الفريق. الدفع لا يُعتبر مؤكداً إلا بعد مراجعة المسؤول.</p>
      <div class="row" style="justify-content:center"><a class="btn gold" routerLink="/orders" [queryParams]="{ id: done()!.bookingId }">تتبع الطلب</a><a class="btn ghost" routerLink="/">الرئيسية</a></div>
    </div>
  } @else {
    <h1 style="font-size:1.7rem">احجز تجديد باقتك</h1>
    <div class="progress"><div [style.width.%]="(step() / 5) * 100"></div></div>
    <p class="muted">الخطوة {{ step() }} من 5 — {{ titles[step() - 1] }}</p>

    @switch (step()) {
      @case (1) { <div class="grid g2">
        @for (n of nets(); track n._id) { <button class="card hover pick" [class.sel]="net()?._id === n._id" (click)="pickNet(n)" [style.--c]="n.color"><app-net-logo [n]="n" [size]="52" /><b>{{ n.nameAr }}</b></button> }
      </div> }
      @case (2) { <div class="stack">
        @for (p of pkgs(); track p._id) {
          <button class="card hover pkrow" [class.sel]="pkg()?._id === p._id" [disabled]="!p.isBookable" (click)="pickPkg(p)">
            <div style="text-align:start"><b>{{ p.name }}</b><div class="muted small">{{ meta(p) }}</div>
              @if (!p.isAvailable) { <span class="badge bad">غير متاحة</span> } @else if (p.price == null) { <span class="badge warn">السعر قيد التأكيد</span> }</div>
            @if (p.price != null) { <div class="price" style="font-size:1.5rem">{{ fmt(p.price) }}<small>ج</small></div> }
          </button>
        } @empty { <div class="empty">لا توجد باقات لهذه الشبكة</div> }
        <button class="btn ghost" (click)="step.set(1)"><app-icon name="arrowRight" [size]="17" /> رجوع</button>
      </div> }
      @case (3) { <form [formGroup]="f" class="stack" (ngSubmit)="next3()">
        <div class="field"><label>الاسم بالكامل</label><input formControlName="customerName" autocomplete="name" placeholder="مثال: سارة أحمد">@if (bad('customerName')) { <div class="err">اكتب اسمك (حرفين على الأقل)</div> }</div>
        <div class="field"><label>رقم موبايلك (للتواصل)</label><input formControlName="customerPhone" inputmode="tel" autocomplete="tel" placeholder="010XXXXXXXX" dir="ltr">@if (bad('customerPhone')) { <div class="err">رقم موبايل مصري غير صحيح</div> }</div>
        <div class="field"><label>الرقم المطلوب تجديده</label><input formControlName="renewalPhone" inputmode="tel" placeholder="010XXXXXXXX" dir="ltr">@if (bad('renewalPhone')) { <div class="err">رقم موبايل مصري غير صحيح</div> }</div>
        <div class="row"><button type="button" class="btn ghost" (click)="step.set(2)"><app-icon name="arrowRight" [size]="17" /> رجوع</button><button class="btn gold grow">التالي</button></div>
      </form> }
      @case (4) { <div class="stack">
        <div class="stack">
          @for (m of methods(); track m.key) { <button class="card hover pkrow" [class.sel]="f.value.paymentMethod === m.key" (click)="f.patchValue({ paymentMethod: m.key })"><div style="text-align:start"><b>{{ m.label }}</b>
            @if (m.accountNumber) { <div dir="ltr" class="gold" style="text-align:start;font-weight:700">{{ m.accountNumber }} {{ m.accountName }}</div> } @else { <div class="muted small">بيانات التحويل ستظهر هنا بعد إضافتها من الإدارة</div> }
            @if (m.instructions) { <div class="muted small">{{ m.instructions }}</div> }</div></button>
        } @empty { <div class="empty">لا توجد طرق دفع متاحة حالياً، تواصل معنا على واتساب.</div> }
        </div>
        @if (method()?.requiresReceipt) {
          <div class="field"><label>صورة إيصال الدفع (JPG / PNG / WebP / PDF — حتى 5MB)</label>
            <label class="drop"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="onFile($event)" hidden>
              @if (preview()) { <img [src]="preview()" alt="الإيصال"> } @else if (file()) { <span class="upload-state"><app-icon name="file" [size]="20" /> {{ file()!.name }}</span> } @else { <span class="upload-state"><app-icon name="cloudUpload" [size]="23" /> اضغط لاختيار الإيصال</span> }</label></div>
        }
        <p class="muted small"><app-icon name="message" [size]="15" /> لا تُرسل رسائل تلقائية. عند الحاجة، قد يتواصل معك المسؤول يدويًا عبر واتساب.</p>
        @if (method()?.requiresReceipt && !file()) { <p class="muted small form-hint"><app-icon name="cloudUpload" [size]="16" /> ارفعي صورة الإيصال لتفعيل زر مراجعة الطلب.</p> }
        <div class="row"><button class="btn ghost" (click)="step.set(3)"><app-icon name="arrowRight" [size]="17" /> رجوع</button><button class="btn gold grow" [disabled]="!canPay()" (click)="step.set(5)">مراجعة الطلب</button></div>
      </div> }
      @case (5) { <div class="stack">
        <div class="card"><dl>
          <dt>الشبكة</dt><dd>{{ net()?.nameAr }}</dd><dt>الباقة</dt><dd>{{ pkg()?.name }}</dd><dt>الاسم</dt><dd>{{ f.value.customerName }}</dd>
          <dt>موبايلك</dt><dd dir="ltr">{{ f.value.customerPhone }}</dd><dt>رقم التجديد</dt><dd dir="ltr">{{ f.value.renewalPhone }}</dd>
          <dt>طريقة الدفع</dt><dd>{{ method()?.label }}</dd><dt>الإيصال</dt><dd>{{ file()?.name || 'غير مطلوب' }}</dd>
        </dl><div class="row between" style="border-top:1px solid var(--line);padding-top:12px"><span>الإجمالي</span><span class="price">{{ fmt(pkg()?.price) }}<small>جنيه</small></span></div></div>
        <div class="row"><button class="btn ghost" (click)="step.set(4)"><app-icon name="arrowRight" [size]="17" /> رجوع</button><button class="btn gold grow" [disabled]="sending()" (click)="submit()">@if (sending()) { <span class="spinner"></span> } تأكيد وإرسال الطلب</button></div>
      </div> }
    }
  }</div>`,
  styles: [`.progress{height:6px;background:rgba(255,255,255,.08);border-radius:9px;margin:14px 0 6px;overflow:hidden;div{height:100%;background:var(--grad-gold);transition:width .4s;border-radius:9px}}
  .pick{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;border-bottom:3px solid var(--c)} .sel{border-color:var(--gold-400)!important;box-shadow:var(--glow-gold)!important}
  .pkrow{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;width:100%;color:inherit} .pkrow:disabled{opacity:.5;cursor:not-allowed} .small{font-size:.85rem}
  .drop{display:grid;place-items:center;min-height:120px;border:1px dashed rgba(167,139,250,.35);border-radius:16px;cursor:pointer;padding:10px;transition:border-color .2s,background .2s;&:hover{border-color:var(--purple-400);background:rgba(139,92,246,.05)}img{max-height:220px;border-radius:10px}}
  .upload-state{display:flex;align-items:center;gap:9px;color:var(--purple-300)}.form-hint{display:flex;align-items:center;gap:7px;margin:0}.form-hint app-icon{color:var(--purple-300)}
  .success-mark{width:64px;height:64px;margin:0 auto 12px;display:grid;place-items:center;border-radius:20px;color:var(--ok);background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25)}
  dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0 0 12px;dt{color:var(--muted)}dd{margin:0;font-weight:600;text-align:end}}
  .ok-card{border-color:rgba(52,211,153,.5)} .bid{display:inline-block;font-size:1.6rem;font-weight:800;letter-spacing:2px;padding:10px 22px;border-radius:14px;border:1px dashed var(--gold-400);color:var(--gold-400);cursor:copy;margin-bottom:12px;direction:ltr}`],
})
export class BookingComponent implements OnInit {
  private api = inject(ApiService); private fb = inject(FormBuilder); private route = inject(ActivatedRoute); private toast = inject(ToastService); private st = inject(SettingsService);
  fmt = fmt; titles = ['الشبكة', 'الباقة', 'بياناتك', 'الدفع', 'المراجعة'];
  step = signal(1); nets = signal<Network[]>([]); pkgs = signal<Pkg[]>([]); net = signal<Network | null>(null); pkg = signal<Pkg | null>(null);
  file = signal<File | null>(null); preview = signal<string | null>(null); sending = signal(false); done = signal<{ bookingId: string; packageName: string; price: number } | null>(null);
  methods = computed<PaymentMethod[]>(() => this.st.data()?.paymentMethods || []);
  f = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]], customerPhone: ['', [Validators.required, Validators.pattern(PHONE)]],
    renewalPhone: ['', [Validators.required, Validators.pattern(PHONE)]], paymentMethod: [''],
  });
  method = () => { const k = this.f.value.paymentMethod; return this.methods().find(m => m.key === k) || null; };
  ngOnInit() {
    this.api.networks().subscribe(n => this.nets.set(n));
    const id = this.route.snapshot.queryParamMap.get('package');
    if (id) this.api.package(id).subscribe({ next: p => { if (p.isBookable && typeof p.network === 'object') { this.net.set(p.network as Network); this.pkg.set(p); this.step.set(3); } } });
  }
  meta(p: Pkg) { return [p.internetQuota, p.minutes, p.validity].filter(x => x).join(' · '); }
  pickNet(n: Network) { this.net.set(n); this.pkg.set(null); this.api.packages({ network: n.key }).subscribe(p => this.pkgs.set(p)); this.step.set(2); }
  pickPkg(p: Pkg) { this.pkg.set(p); this.step.set(3); }
  bad(c: 'customerName' | 'customerPhone' | 'renewalPhone') { const x = this.f.controls[c]; return x.invalid && (x.dirty || x.touched); }
  next3() { this.f.markAllAsTouched(); if (this.f.valid) this.step.set(4); }
  onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return this.toast.show('حجم الملف أكبر من 5MB', 'err');
    this.file.set(file); this.preview.set(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }
  canPay() { return !!this.method() && (!this.method()!.requiresReceipt || !!this.file()); }
  copy(t: string) { navigator.clipboard?.writeText(t).then(() => this.toast.ok('تم نسخ رقم الطلب')); }
  submit() {
    const fd = new FormData(); const v = this.f.getRawValue();
    fd.append('packageId', this.pkg()!._id); fd.append('customerName', v.customerName); fd.append('customerPhone', v.customerPhone);
    fd.append('renewalPhone', v.renewalPhone); fd.append('paymentMethod', v.paymentMethod);
    if (this.file()) fd.append('receipt', this.file()!);
    this.sending.set(true);
    this.api.createBooking(fd).subscribe({ next: r => { this.sending.set(false); this.done.set(r); window.scrollTo({ top: 0 }); }, error: e => { this.sending.set(false); this.toast.err(e); } });
  }
}
