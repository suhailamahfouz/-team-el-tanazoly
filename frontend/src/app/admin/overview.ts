import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { fmt, fmtDate } from '../core/ui';
import { StatusComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-overview', standalone: true, imports: [RouterLink, StatusComponent, IconComponent],
  template: `<header class="dash-heading"><div><p class="eyebrow">مركز الإدارة</p><h1>نظرة عامة</h1><p class="muted">ملخص الحجوزات والأداء المالي.</p></div><a routerLink="/admin/bookings" class="btn"><app-icon name="clipboard" [size]="17" /> إدارة الطلبات</a></header>
  @if (d(); as s) {
    <div class="grid g4 metrics">
      <div class="card metric"><span class="metric-icon"><app-icon name="clipboard" [size]="18" /></span><span class="muted">إجمالي الحجوزات</span><div class="big">{{ fmt(s.totals.all) }}</div></div>
      <div class="card metric"><span class="metric-icon pending"><app-icon name="clock" [size]="18" /></span><span class="muted">بانتظار المراجعة</span><div class="big warn">{{ fmt(s.totals.pending + s.totals.payment_review) }}</div></div>
      <div class="card metric"><span class="metric-icon success"><app-icon name="circleCheck" [size]="18" /></span><span class="muted">تم التجديد</span><div class="big ok">{{ fmt(s.totals.activated) }}</div></div>
      <div class="card metric"><span class="metric-icon rejected"><app-icon name="circleX" [size]="18" /></span><span class="muted">مرفوض</span><div class="big bad">{{ fmt(s.totals.rejected) }}</div></div>
    </div>
    <div class="grid g2 secondary-metrics">
      <div class="card revenue-card"><div class="row between"><span class="muted">إيرادات الطلبات المجددة</span><span class="metric-icon revenue"><app-icon name="banknote" [size]="18" /></span></div><div class="price">{{ fmt(s.revenue.activated) }}<small>جنيه</small></div>
        <div class="muted small">قيد التنفيذ: {{ fmt(s.revenue.inProgress) }} <span class="sep">·</span> بانتظار الدفع: {{ fmt(s.revenue.awaitingPayment) }}</div></div>
      <div class="card network-card"><div class="card-heading"><span class="metric-icon"><app-icon name="radio" [size]="18" /></span><div><h2>الأداء حسب الشبكة</h2><p class="muted small">الحجوزات والإيرادات</p></div></div>@for (n of s.byNetwork; track n.network) { <div class="network-row"><span>{{ n.network }}</span><b>{{ n.count }} <span class="muted">طلب</span> · {{ fmt(n.revenue) }} ج</b></div> } @empty { <div class="empty">لا توجد بيانات حتى الآن</div> }</div>
    </div>
    <div class="card chart-card"><div class="card-heading"><span class="metric-icon revenue"><app-icon name="chart" [size]="18" /></span><div><h2>الإيرادات اليومية</h2><p class="muted small">آخر 30 يومًا</p></div></div>
      <div class="bars">@for (x of s.daily; track x.date) { <div class="bar" [style.height.%]="(x.revenue / max(s)) * 100" [title]="x.date + ': ' + x.revenue"></div> } @empty { <span class="muted">لا توجد تفعيلات بعد</span> }</div></div>
    <section class="recent-section"><div class="row between section-title-row"><div><p class="eyebrow">آخر التحديثات</p><h2>أحدث الطلبات</h2></div><a routerLink="/admin/bookings" class="gold all-link">عرض الكل <app-icon name="arrowLeft" [size]="16" /></a></div>
    <div class="table-wrap"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الباقة</th><th>السعر</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
      @for (b of s.recent; track b.bookingId) { <tr><td dir="ltr">{{ b.bookingId }}</td><td>{{ b.customerName }}</td><td>{{ b.packageSnapshot.name }}</td><td>{{ fmt(b.price) }}</td><td><app-status [value]="b.status" /></td><td>{{ fmtDate(b.createdAt) }}</td></tr> } @empty { <tr><td class="empty" colspan="6">لا توجد طلبات حتى الآن</td></tr> }</tbody></table></div></section>
  } @else { <div class="skeleton"></div> }`,
  styles: [`.dash-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}.dash-heading h1{font-size:1.75rem;margin:0}.dash-heading p{margin:2px 0}.dash-heading .btn{min-height:40px;padding-inline:15px;font-size:.88rem}.eyebrow{font-size:.76rem;color:var(--purple-300);font-weight:800;letter-spacing:.03em}.metrics{margin-bottom:14px}.metric{display:grid;gap:8px;align-content:start;min-height:132px}.metric-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:rgba(139,92,246,.11);color:var(--purple-300)}.metric-icon.pending{background:rgba(251,191,36,.1);color:var(--warn)}.metric-icon.success{background:rgba(52,211,153,.1);color:var(--ok)}.metric-icon.rejected{background:rgba(248,113,113,.1);color:var(--bad)}.metric-icon.revenue{background:rgba(245,196,81,.1);color:var(--gold-400)}
  .big{font-size:1.8rem;font-weight:800;line-height:1.2}.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.small{font-size:.82rem}.secondary-metrics{margin-bottom:14px}.revenue-card .price{margin:8px 0 2px;font-size:2.3rem}.sep{padding-inline:5px;color:var(--line)}.card-heading{display:flex;align-items:center;gap:11px;margin-bottom:13px}.card-heading h2{font-size:1rem;margin:0}.card-heading p{margin:1px 0 0}.network-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:.88rem}.network-row b{font-size:.84rem}.chart-card{margin-bottom:22px}.bars{display:flex;align-items:flex-end;gap:5px;height:132px;padding-top:14px;border-bottom:1px solid var(--line)}.bar{flex:1;min-width:3px;max-width:20px;min-height:4px;background:linear-gradient(180deg,var(--purple-400),rgba(109,69,207,.62));border-radius:6px 6px 0 0;transition:opacity .15s}.bar:hover{opacity:.7}.recent-section .section-title-row{align-items:flex-end;margin-bottom:10px}.recent-section h2{font-size:1.1rem;margin:0}.all-link{display:inline-flex;align-items:center;gap:6px;font-size:.86rem;font-weight:700}
  @media(max-width:600px){.dash-heading{align-items:flex-start}.dash-heading .btn{width:100%}.metric{min-height:112px;padding:13px}.big{font-size:1.5rem}.revenue-card .price{font-size:2rem}.network-row{align-items:flex-start}.network-row b{text-align:end}.bars{height:105px;gap:3px}}`],
})
export class OverviewComponent {
  d = signal<any>(null); fmt = fmt; fmtDate = fmtDate; max = (s: any) => Math.max(1, ...s.daily.map((x: any) => x.revenue));
  constructor() { inject(ApiService).stats().subscribe(s => this.d.set(s)); }
}
