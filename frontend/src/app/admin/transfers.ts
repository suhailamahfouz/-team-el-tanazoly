import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Page, Transfer, WA_STATUS_LABEL } from '../core/models';
import { ToastService, fmt, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-transfers', standalone: true, imports: [FormsModule, RouterLink, StatusComponent, IconComponent],
  template: `<div class="row between heading"><div><p class="eyebrow">المراجعة المالية</p><h1>التحويلات</h1><p class="muted">سجّلي التحويلات وراجعي الإيصالات وحالة كل دفعة.</p></div></div>
    <div class="filters grid">
      <input placeholder="رقم الطلب أو المرجع أو طريقة الدفع" [(ngModel)]="q" (keyup.enter)="load(1)">
      <select [(ngModel)]="status" (ngModelChange)="load(1)"><option value="">كل الحالات</option><option value="pending">قيد المراجعة</option><option value="confirmed">مؤكد</option><option value="rejected">مرفوض</option></select>
      <select [(ngModel)]="method" (ngModelChange)="load(1)"><option value="">كل وسائل الدفع</option>@for(m of methods; track m.key) { <option [value]="m.key">{{ m.label }}</option> }</select>
      <button class="btn sm" (click)="load(1)"><app-icon name="search" [size]="16" /> بحث</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>الوسيلة</th><th>المرجع</th><th>الإيصال</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>
      @for(t of data()?.items; track t._id) { <tr><td>{{ fmtDate(t.createdAt) }}</td><td dir="ltr"><a class="link" [routerLink]="['/admin/bookings']" [queryParams]="{ q:t.bookingId }">{{ t.bookingId }}</a></td><td>{{ customerName(t) }}</td><td class="amount">{{ fmt(t.amount) }} ج</td><td>{{ paymentLabel(t.method) }}</td><td dir="ltr">{{ t.reference || '—' }}</td><td>@if(t.receipt?.file){<button class="btn ghost sm" (click)="receipt(t)"><app-icon name="file" [size]="15" /> عرض</button>} @else {<span class="muted">—</span>}</td><td><app-status [value]="t.status" /></td><td>@if(t.status === 'pending'){<div class="row"><button class="btn ok sm" (click)="review(t,'confirmed')">تأكيد</button><button class="btn danger sm" (click)="review(t,'rejected')">رفض</button></div>} @else {<span class="muted small">{{ t.reviewedBy || '—' }}</span>}</td></tr> }
      @empty { <tr><td class="empty" colspan="9">لا توجد تحويلات مطابقة</td></tr> }
    </tbody></table></div>
    @if(data(); as d){<div class="row between pages"><span class="muted">{{ d.total }} تحويل</span><div class="row"><button class="btn ghost sm" [disabled]="d.page <= 1" (click)="load(d.page-1)"><app-icon name="chevronRight" [size]="15"/> السابق</button><span>{{ d.page }} / {{ d.pages || 1 }}</span><button class="btn ghost sm" [disabled]="d.page >= d.pages" (click)="load(d.page+1)">التالي <app-icon name="chevronLeft" [size]="15"/></button></div></div>}`,
  styles: [`.heading{margin-bottom:16px;align-items:flex-end}.heading h1{font-size:1.6rem;margin:0}.heading p{margin:3px 0}.eyebrow{font-size:.76rem;color:var(--purple-300);font-weight:800}.filters{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px}.amount{font-weight:800;color:var(--gold-400)}.link{color:var(--purple-300);font-weight:700}.pages{margin-top:12px}.small{font-size:.8rem}`],
})
export class AdminTransfersComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  data = signal<Page<Transfer> | null>(null); q = ''; status = ''; method = '';
  methods = [{ key: 'vodafone_cash', label: 'Vodafone Cash' }, { key: 'instapay', label: 'InstaPay' }];
  fmt = fmt; fmtDate = fmtDate;
  ngOnInit() { this.api.transferMethods().subscribe({ next: methods => this.methods = methods, error: e => this.toast.err(e) }); this.load(1); }
  load(page: number) { this.api.transfers({ page, q: this.q, status: this.status, method: this.method }).subscribe({ next: d => this.data.set(d), error: e => this.toast.err(e) }); }
  customerName(t: Transfer) { return typeof t.booking === 'object' ? t.booking.customerName : '—'; }
  paymentLabel(method: string) { return this.methods.find(m => m.key === method)?.label || method; }
  receipt(t: Transfer) { this.api.transferReceipt(t._id).subscribe({ next: blob => window.open(URL.createObjectURL(blob), '_blank', 'noopener'), error: e => this.toast.err(e) }); }
  review(t: Transfer, status: 'confirmed'|'rejected') {
    if (!confirm(status === 'confirmed' ? 'تأكيد استلام التحويل؟' : 'رفض التحويل؟')) return;
    this.api.reviewTransfer(t._id, status).subscribe({ next: () => { this.toast.ok(status === 'confirmed' ? 'تم تأكيد التحويل وتحديث الطلب' : 'تم رفض التحويل'); this.load(this.data()?.page || 1); }, error: e => this.toast.err(e) });
  }
}
