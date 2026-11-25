import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';
import { ApiService } from '../core/api.service';
import { fmt } from '../core/ui';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-profile', standalone: true, imports: [RouterLink, IconComponent],
  template: `<div class="profile-page">
    <header class="profile-heading">
      <div><p class="eyebrow">مساحة الإدارة</p><h1>ملف الإدارة</h1><p class="muted">إدارة الحجوزات والباقات من مكان واحد.</p></div>
      <a routerLink="/admin/bookings" class="btn"><app-icon name="clipboard" [size]="17" /> عرض الحجوزات</a>
    </header>

    <section class="card identity">
      <div class="avatar"><app-icon name="user" [size]="28" /></div>
      <div class="identity-copy"><h2>{{ auth.admin()?.name || 'مسؤول النظام' }}</h2><p class="muted" dir="ltr">{{ auth.admin()?.email }}</p></div>
      <span class="role"><app-icon name="shield" [size]="15" />{{ auth.isAdmin() ? 'مدير النظام' : 'موظف' }}</span>
    </section>

    @if (stats(); as s) {
      <section class="grid g4 metrics">
        <article class="card metric"><span class="metric-icon"><app-icon name="clipboard" [size]="18" /></span><span class="muted">كل الحجوزات</span><strong>{{ fmt(s.totals.all) }}</strong></article>
        <article class="card metric"><span class="metric-icon pending"><app-icon name="clock" [size]="18" /></span><span class="muted">تحتاج مراجعة</span><strong>{{ fmt(s.totals.pending + s.totals.payment_review) }}</strong></article>
        <article class="card metric"><span class="metric-icon success"><app-icon name="circleCheck" [size]="18" /></span><span class="muted">تم التفعيل</span><strong>{{ fmt(s.totals.activated) }}</strong></article>
        <article class="card metric"><span class="metric-icon revenue"><app-icon name="banknote" [size]="18" /></span><span class="muted">إيراد التفعيلات</span><strong>{{ fmt(s.revenue.activated) }} <small>جنيه</small></strong></article>
      </section>
    } @else { <div class="grid g4"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div> }

    <h2 class="section-title">إدارة النشاط</h2>
    <section class="grid g2 actions">
      <a routerLink="/admin/bookings" class="card action-card">
        <span class="action-icon"><app-icon name="clipboard" [size]="22" /></span>
        <span class="action-copy"><strong>طلبات الحجز</strong><small>راجعي الطلبات، الإيصالات، وأكدي الدفع أو التفعيل.</small></span>
        <app-icon name="arrowLeft" [size]="18" />
      </a>
      <a routerLink="/admin/transfers" class="card action-card">
        <span class="action-icon"><app-icon name="wallet" [size]="22" /></span>
        <span class="action-copy"><strong>التحويلات</strong><small>سجّلي الدفعات وراجعي الإيصالات وأكدي أو ارفضي التحويل.</small></span>
        <app-icon name="arrowLeft" [size]="18" />
      </a>
      @if (auth.isAdmin()) {
        <a routerLink="/admin/packages" class="card action-card">
          <span class="action-icon"><app-icon name="package" [size]="22" /></span>
          <span class="action-copy"><strong>إدارة الباقات</strong><small>أضيفي باقات جديدة، عدّلي الأسعار والتفاصيل، أو احذفي باقة.</small></span>
          <app-icon name="arrowLeft" [size]="18" />
        </a>
        <a routerLink="/admin/settings" class="card action-card">
          <span class="action-icon"><app-icon name="settings" [size]="22" /></span>
          <span class="action-copy"><strong>إعدادات الموقع</strong><small>حدّثي بيانات النشاط وطرق الدفع ومعلومات التواصل.</small></span>
          <app-icon name="arrowLeft" [size]="18" />
        </a>
      }
      <a routerLink="/admin/customers" class="card action-card">
        <span class="action-icon"><app-icon name="users" [size]="22" /></span>
        <span class="action-copy"><strong>العملاء</strong><small>اطّلعي على بيانات العملاء وسجل حجوزاتهم.</small></span>
        <app-icon name="arrowLeft" [size]="18" />
      </a>
    </section>

    @if (auth.isAdmin()) {
      <aside class="access-note"><app-icon name="shield" [size]="18" /><span>لديك صلاحية المدير لإضافة الباقات وتعديلها وحذفها. التغييرات تظهر للعملاء مباشرة.</span></aside>
    }
  </div>`,
  styles: [`
    .profile-page{max-width:1120px;margin:0 auto}
    .profile-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
    .profile-heading h1{font-size:clamp(1.6rem,4vw,2rem);margin-bottom:4px}
    .profile-heading p{margin:0}.eyebrow{font-size:.76rem;color:var(--purple-300);font-weight:800;letter-spacing:.04em;margin-bottom:4px!important}
    .profile-heading .btn{min-height:40px;padding-inline:15px;font-size:.88rem}
    .identity{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:17px 20px}
    .avatar{width:54px;height:54px;display:grid;place-items:center;flex:none;border-radius:17px;color:var(--purple-300);background:rgba(139,92,246,.14);border:1px solid rgba(167,139,250,.22)}
    .identity-copy{min-width:0;flex:1}.identity h2{font-size:1.05rem;margin:0 0 2px}.identity p{font-size:.84rem;margin:0;overflow-wrap:anywhere}
    .role{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(167,139,250,.22);border-radius:999px;color:var(--purple-300);font-size:.78rem;font-weight:700;white-space:nowrap}
    .metrics{margin-bottom:22px}.metric{display:grid;gap:8px;align-content:start;min-height:126px}.metric-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:rgba(139,92,246,.12);color:var(--purple-300)}
    .metric-icon.pending{background:rgba(251,191,36,.1);color:var(--warn)}.metric-icon.success{background:rgba(52,211,153,.1);color:var(--ok)}.metric-icon.revenue{background:rgba(245,196,81,.1);color:var(--gold-400)}
    .metric strong{font-size:1.45rem;line-height:1.2}.metric strong small{font-size:.72rem;color:var(--muted);font-weight:600}
    .section-title{font-size:1.1rem;margin:0 0 12px}.actions{gap:12px}
    .action-card{display:flex;align-items:center;gap:13px;min-height:98px;padding:16px;text-decoration:none;transition:transform .18s,border-color .18s,background .18s}
    .action-card:hover{transform:translateY(-2px);border-color:rgba(167,139,250,.4);background:linear-gradient(145deg,rgba(33,43,84,.95),rgba(12,18,40,.98))}
    .action-icon{width:44px;height:44px;display:grid;place-items:center;flex:none;border-radius:14px;background:rgba(139,92,246,.12);color:var(--purple-300)}
    .action-copy{display:grid;gap:3px;flex:1}.action-copy strong{font-size:.94rem}.action-copy small{color:var(--muted);font-size:.77rem;line-height:1.5}.action-card>app-icon{color:var(--muted)}
    .access-note{display:flex;align-items:flex-start;gap:9px;margin-top:16px;padding:12px 14px;border:1px solid rgba(167,139,250,.18);border-radius:13px;background:rgba(139,92,246,.06);color:var(--muted);font-size:.82rem}.access-note app-icon{color:var(--purple-300);flex:none}
    @media(max-width:600px){.identity{flex-wrap:wrap}.role{margin-inline-start:68px}.metric{min-height:110px;padding:14px}.metric strong{font-size:1.2rem}.action-card{padding:13px}.profile-heading .btn{width:100%}}
  `],
})
export class AdminProfileComponent implements OnInit {
  auth = inject(AuthService);
  stats = signal<any>(null);
  fmt = fmt;
  private api = inject(ApiService);
  ngOnInit() { this.api.stats().subscribe(data => this.stats.set(data)); }
}
