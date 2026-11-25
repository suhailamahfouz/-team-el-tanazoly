import { Component, inject, signal } from '@angular/core';
import { SettingsService } from '../core/ui';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-contact', standalone: true, imports: [IconComponent],
  template: `<div class="container section" style="max-width:760px">
  <h1 style="font-size:1.7rem">تواصل معنا</h1>
  <div class="grid g2">
    @if (s.waLink()) { <a class="card hover contact-card" [href]="s.waLink('أهلاً، عايز أستفسر')" target="_blank" rel="noopener"><span class="icon-box"><app-icon name="message" [size]="22" /></span><h3>واتساب</h3><span class="muted" dir="ltr">{{ s.data()?.contact?.whatsapp }}</span></a> }
    @if (s.data()?.contact?.phone) { <a class="card hover contact-card" [href]="'tel:' + s.data()!.contact.phone"><span class="icon-box"><app-icon name="phone" [size]="22" /></span><h3>اتصال</h3><span class="muted" dir="ltr">{{ s.data()!.contact.phone }}</span></a> }
    @if (s.data()?.contact?.email) { <a class="card hover contact-card" [href]="'mailto:' + s.data()!.contact.email"><span class="icon-box"><app-icon name="mail" [size]="22" /></span><h3>البريد</h3><span class="muted">{{ s.data()!.contact.email }}</span></a> }
    @if (s.data()?.contact?.hours) { <div class="card contact-card"><span class="icon-box"><app-icon name="clock" [size]="22" /></span><h3>مواعيد الدعم</h3><span class="muted">{{ s.data()!.contact.hours }}</span></div> }
  </div>
  @if (!s.data()?.contact?.whatsapp && !s.data()?.contact?.phone) { <div class="empty">بيانات التواصل سيتم إضافتها قريباً.</div> }
  <h2 style="margin-top:28px">أسئلة شائعة</h2>
  <div class="stack">
    @for (f of s.data()?.faq || []; track f.q; let i = $index) {
      <div class="card faq" (click)="open.set(open() === i ? -1 : i)"><div class="row between"><b>{{ f.q }}</b><span class="gold"><app-icon [name]="open() === i ? 'chevronUp' : 'chevronDown'" [size]="18" /></span></div>
        @if (open() === i) { <p class="muted" style="margin:10px 0 0">{{ f.a }}</p> }</div>
    }
  </div></div>`,
  styles: [`.faq{cursor:pointer;padding:14px 18px}.contact-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.icon-box{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;color:var(--purple-400);background:rgba(139,92,246,.13);border:1px solid rgba(167,139,250,.16)}`],
})
export class ContactComponent { s = inject(SettingsService); open = signal(0); }
