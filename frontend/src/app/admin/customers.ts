import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Booking, Page } from '../core/models';
import { fmt, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-customers', standalone: true, imports: [FormsModule, StatusComponent, IconComponent],
  template: `<h1 style="font-size:1.6rem">العملاء</h1>
  <div class="row"><input class="grow" placeholder="بحث بالاسم أو الموبايل" [(ngModel)]="q" (keyup.enter)="load(1)"><button class="btn sm" (click)="load(1)"><app-icon name="search" [size]="16" /> بحث</button></div>
  <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>الاسم</th><th>الموبايل</th><th>عدد الحجوزات</th><th>آخر نشاط</th></tr></thead><tbody>
    @for (c of data()?.items; track c._id) { <tr class="click" (click)="open(c._id)"><td>{{ c.name }}</td><td dir="ltr">{{ c.phone }}</td><td>{{ c.bookingsCount }}</td><td>{{ fmtDate(c.updatedAt) }}</td></tr> } @empty { <tr><td colspan="4" class="empty">لا يوجد عملاء</td></tr> }</tbody></table></div>
  @if (data(); as d) { <div class="row" style="margin-top:12px;justify-content:center"><button class="btn ghost sm" [disabled]="d.page <= 1" (click)="load(d.page - 1)"><app-icon name="chevronRight" [size]="15" /> السابق</button><span>{{ d.page }} / {{ d.pages || 1 }}</span><button class="btn ghost sm" [disabled]="d.page >= d.pages" (click)="load(d.page + 1)">التالي <app-icon name="chevronLeft" [size]="15" /></button></div> }
  @if (sel(); as s) { <div class="modal-bg" (click)="sel.set(null)"><div class="modal" (click)="$event.stopPropagation()">
    <h2>{{ s.customer.name }} <span class="muted" dir="ltr" style="font-size:1rem">{{ s.customer.phone }}</span></h2>
    @for (b of s.bookings; track b._id) { <div class="row between card" style="margin-bottom:8px;padding:12px"><span dir="ltr">{{ b.bookingId }}</span><span>{{ b.packageSnapshot.name }}</span><b>{{ fmt(b.price) }}</b><app-status [value]="b.status" /></div> }
    <button class="btn ghost block" (click)="sel.set(null)">إغلاق</button></div></div> }`,
})
export class AdminCustomersComponent implements OnInit {
  private api = inject(ApiService); fmt = fmt; fmtDate = fmtDate; q = ''; data = signal<Page<any> | null>(null); sel = signal<{ customer: any; bookings: Booking[] } | null>(null);
  ngOnInit() { this.load(1); }
  load(page: number) { this.api.customers({ q: this.q, page }).subscribe(d => this.data.set(d)); }
  open(id: string) { this.api.customer(id).subscribe(s => this.sel.set(s)); }
}
