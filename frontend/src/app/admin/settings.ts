import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Settings } from '../core/models';
import { SettingsService, ToastService } from '../core/ui';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-settings', standalone: true, imports: [FormsModule, IconComponent],
  template: `<h1 style="font-size:1.6rem">الإعدادات</h1>
  @if (s(); as x) { <div class="stack">
    <div class="card stack"><h3>بيانات النشاط</h3><div class="grid g2">
      <div class="field"><label>اسم النشاط</label><input [(ngModel)]="x.businessName"></div><div class="field"><label>الشعار النصي</label><input [(ngModel)]="x.tagline"></div>
      <div class="field"><label>واتساب للتواصل</label><input [(ngModel)]="x.contact.whatsapp" dir="ltr" placeholder="01XXXXXXXXX"></div><div class="field"><label>هاتف</label><input [(ngModel)]="x.contact.phone" dir="ltr"></div>
      <div class="field"><label>بريد</label><input [(ngModel)]="x.contact.email" dir="ltr"></div><div class="field"><label>مواعيد الدعم</label><input [(ngModel)]="x.contact.hours"></div>
      <div class="field"><label>لوجو النشاط</label><input type="file" accept="image/*" (change)="logo($event, x)"></div></div></div>
    <div class="card stack"><div class="row between"><h3 style="margin:0">طرق الدفع</h3><button class="btn ghost sm" (click)="addPm(x)"><app-icon name="plus" [size]="16" /> إضافة</button></div>
      @for (m of x.paymentMethods; track $index) { <div class="grid g2 pm"><div class="field"><label>المعرّف</label><input [(ngModel)]="m.key" dir="ltr"></div><div class="field"><label>الاسم</label><input [(ngModel)]="m.label"></div>
        <div class="field"><label>رقم الحساب / المحفظة</label><input [(ngModel)]="m.accountNumber" dir="ltr"></div><div class="field"><label>اسم صاحب الحساب</label><input [(ngModel)]="m.accountName"></div>
        <div class="field" style="grid-column:1/-1"><label>تعليمات</label><input [(ngModel)]="m.instructions"></div>
        <label class="row"><input type="checkbox" [(ngModel)]="m.requiresReceipt"> يتطلب إيصال</label><label class="row"><input type="checkbox" [(ngModel)]="m.enabled"> مفعّلة</label>
        <button class="btn danger sm" (click)="x.paymentMethods.splice($index, 1)">حذف</button></div> }</div>
    <div class="card stack"><div class="row between"><h3 style="margin:0">الأسئلة الشائعة</h3><button class="btn ghost sm" (click)="x.faq.push({ q: '', a: '' })">+ إضافة</button></div>
      @for (f of x.faq; track $index) { <div class="stack pm"><input [(ngModel)]="f.q" placeholder="السؤال"><textarea [(ngModel)]="f.a" placeholder="الإجابة"></textarea><button class="btn danger sm" (click)="x.faq.splice($index, 1)">حذف</button></div> }</div>
    <button class="btn gold" (click)="save(x)"><app-icon name="save" [size]="17" /> حفظ الإعدادات</button></div> }`,
  styles: [`.pm{padding:12px;border:1px solid var(--line);border-radius:14px}`],
})
export class AdminSettingsComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private pub = inject(SettingsService); s = signal<Settings | null>(null);
  ngOnInit() { this.api.adminSettings().subscribe(x => this.s.set(x)); }
  addPm(x: Settings) { x.paymentMethods.push({ key: '', label: '', accountNumber: '', accountName: '', instructions: '', requiresReceipt: true, enabled: true }); }
  logo(e: Event, x: Settings) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.api.uploadImage(f).subscribe({ next: r => { x.logoUrl = r.url; this.toast.ok('تم رفع اللوجو، اضغط حفظ'); }, error: er => this.toast.err(er) }); }
  save(x: Settings) {
    const body = { businessName: x.businessName, tagline: x.tagline, logoUrl: x.logoUrl || undefined, contact: x.contact, faq: x.faq, paymentMethods: x.paymentMethods };
    this.api.saveSettings(body).subscribe({ next: () => { this.toast.ok('تم الحفظ'); this.api.settings().subscribe(p => this.pub.data.set(p)); }, error: e => this.toast.err(e) });
  }
}
