import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Page, WaMessage, WA_EVENT_LABEL, WA_STATUS_LABEL } from '../core/models';
import { ToastService, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-whatsapp', standalone: true, imports: [FormsModule, StatusComponent, IconComponent],
  template: `<div class="row between heading"><div><p class="eyebrow">تواصل يدوي وآمن</p><h1>سجل واتساب</h1><p class="muted">لا يوجد إرسال تلقائي أو WhatsApp API. فتح المحادثة لا يعني إرسال الرسالة.</p></div></div>
    <div class="filters grid"><input placeholder="رقم الطلب أو الهاتف" [(ngModel)]="q" (keyup.enter)="load(1)">
      <select [(ngModel)]="status" (ngModelChange)="load(1)"><option value="">كل الحالات</option>@for(s of statuses; track s){<option [value]="s">{{ statusLabel[s] || s }}</option>}</select>
      <select [(ngModel)]="event" (ngModelChange)="load(1)"><option value="">كل الرسائل</option>@for(e of events; track e){<option [value]="e">{{ eventLabel[e] || e }}</option>}</select>
      <button class="btn sm" (click)="load(1)"><app-icon name="search" [size]="16" /> بحث</button></div>
    <div class="message-list">
      @for(m of messages()?.items; track m._id){<article class="card message-card"><div class="row between"><div><b>{{ eventLabel[m.event] || m.event }}</b><div class="muted small" dir="ltr">{{ m.bookingId }} · {{ m.to }}</div></div><app-status [value]="m.status" /></div>
        <p class="body">{{ m.body }}</p><div class="muted small">@if(m.openedAt){تم فتح واتساب: {{ fmtDate(m.openedAt) }}} @else {سُجلت كمسودة: {{ fmtDate(m.createdAt) }}} @if(m.manuallyConfirmedAt){ · أكدها {{ m.manuallyConfirmedBy }} في {{ fmtDate(m.manuallyConfirmedAt) }}}</div>
        @if(m.status === 'opened'){<button class="btn ok sm" style="margin-top:10px" (click)="confirm(m)"><app-icon name="circleCheck" [size]="15" /> تأكيد الإرسال اليدوي</button>}
      </article>} @empty {<div class="card empty"><app-icon name="message" [size]="25" /><span>لا توجد رسائل مسجلة. افتحي الطلب واستخدمي زر Click-to-Chat.</span></div>}
    </div>
    @if(messages(); as d){<div class="row between pages"><span class="muted">{{d.total}} رسالة</span><div class="row"><button class="btn ghost sm" [disabled]="d.page<=1" (click)="load(d.page-1)"><app-icon name="chevronRight" [size]="15"/> السابق</button><span>{{d.page}} / {{d.pages || 1}}</span><button class="btn ghost sm" [disabled]="d.page>=d.pages" (click)="load(d.page+1)">التالي <app-icon name="chevronLeft" [size]="15"/></button></div></div>}`,
  styles: [`.heading{margin-bottom:16px;align-items:flex-end}.heading h1{font-size:1.6rem;margin:0}.heading p{margin:4px 0}.eyebrow{font-size:.76rem;color:var(--purple-300);font-weight:800}.filters{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:14px}.message-list{display:grid;gap:10px}.message-card{padding:15px}.small{font-size:.8rem}.body{white-space:pre-wrap;margin:12px 0;padding:12px;border-radius:12px;background:var(--surface-1);font-size:.9rem}.pages{margin-top:14px}.empty{display:grid;justify-items:center;gap:10px}`],
})
export class AdminWhatsappComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  messages = signal<Page<WaMessage> | null>(null); q = ''; status = ''; event = '';
  statusLabel = WA_STATUS_LABEL; eventLabel = WA_EVENT_LABEL; fmtDate = fmtDate;
  statuses = ['prepared', 'opened', 'manually_confirmed']; events = ['booking_created', 'activated', 'custom'];
  ngOnInit() { this.load(1); }
  load(page: number) { this.api.waMessages({ q: this.q, status: this.status, event: this.event, page }).subscribe({ next: d => this.messages.set(d), error: e => this.toast.err(e) }); }
  confirm(message: WaMessage) {
    if (!confirm('هل أرسلت هذه الرسالة فعلًا من واتساب؟')) return;
    this.api.confirmWhatsAppSent(message._id).subscribe({ next: () => { this.toast.ok('تم تسجيل التأكيد اليدوي'); this.load(this.messages()?.page || 1); }, error: e => this.toast.err(e) });
  }
}
