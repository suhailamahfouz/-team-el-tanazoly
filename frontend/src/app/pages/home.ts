import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Network, Pkg } from '../core/models';
import { SettingsService } from '../core/ui';
import { NetLogoComponent, PkgCardComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-home', standalone: true, imports: [RouterLink, NetLogoComponent, PkgCardComponent, IconComponent],
  template: `
  <section class="hero"><div class="container hero-inner">
    <span class="hero-kicker"><span class="kicker-dot"></span> منصة تجديد الباقات</span>
    <h1>جددي باقتك <span>بسهولة وأمان</span></h1>
    <p class="hero-sub">{{ s.data()?.tagline || 'اختاري باقتك، أكملي الحجز، وتابعي حالة الطلب خطوة بخطوة.' }}</p>
    <p class="muted lead">اختاري شبكتك وباقتك، أكملي الحجز، وتابعي حالة طلبك خطوة بخطوة. فريقنا جاهز لمساعدتك.</p>
    <div class="row hero-actions"><a routerLink="/booking" class="btn gold"><app-icon name="shoppingBag" [size]="18" /> احجزي تجديد باقتك</a><a routerLink="/packages" class="btn ghost">تصفحي الباقات</a></div>
  </div></section>

  <section class="section networks-section"><div class="container">
    <div class="section-heading"><p class="eyebrow">الشبكات المتاحة</p><h2>اختاري شبكتك</h2><p class="muted">كل عروضك وباقاتك في مكان واحد.</p></div>
    <div class="grid g4">
      @for (n of nets(); track n._id) {
        <a class="card hover net" [routerLink]="['/packages']" [queryParams]="{ network: n.key }" [style.--c]="n.color">
          <div style="display:grid;place-items:center"><app-net-logo [n]="n" [size]="56" /></div>
          <b>{{ n.nameAr }}</b>
          <span class="muted small">{{ n.nameEn }}</span>
        </a>
      } @empty { @for (i of [1,2,3,4]; track i) { <div class="skeleton"></div> } }
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="row between section-title-row"><div><p class="eyebrow">مختارة لك</p><h2>باقات مميزة</h2></div><a routerLink="/packages" class="gold all-link">عرض كل الباقات <app-icon name="arrowLeft" [size]="16" /></a></div>
    <div class="grid g2">
      @for (p of featured(); track p._id) { <app-pkg-card [p]="p" /> }
      @empty { @if (!loaded()) { <div class="skeleton"></div><div class="skeleton"></div> } @else { <div class="empty">لا توجد عروض مميزة حالياً</div> } }
    </div>
  </div></section>

  <section class="section"><div class="container">
    <h2>إزاي بتتم العملية؟</h2>
    <div class="grid g4">
      @for (st of steps; track st.t; let i = $index) { <div class="card center feature-card"><div class="icon-box"><app-icon [name]="st.i" [size]="21" /></div><span class="step-number">0{{ i + 1 }}</span><h3>{{ st.t }}</h3><p class="muted small">{{ st.d }}</p></div> }
    </div>
  </div></section>

  @if (s.waLink()) {
  <section class="section"><div class="container"><div class="card cta center">
    <h2>محتاج مساعدة؟</h2><p class="muted">كلمنا على الواتساب وهنرد عليك.</p>
    <a class="btn gold" [href]="s.waLink('أهلاً، عايز أستفسر')" target="_blank" rel="noopener"><app-icon name="headset" [size]="18" /> تواصل على واتساب</a>
  </div></div></section> }`,
  styles: [`
  .hero{position:relative;overflow:hidden;padding:clamp(52px,9vw,108px) 0 clamp(42px,7vw,76px);border-bottom:1px solid var(--line);background:radial-gradient(ellipse at 86% 5%,rgba(124,58,237,.18),transparent 44%),radial-gradient(ellipse at 15% 100%,rgba(245,196,81,.08),transparent 46%),linear-gradient(135deg,rgba(12,21,48,.26),transparent)}
  .hero-inner{position:relative;z-index:1}.hero-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(167,139,250,.22);border-radius:999px;background:rgba(139,92,246,.08);color:var(--purple-300);font-size:.84rem;font-weight:700}.kicker-dot{width:7px;height:7px;border-radius:50%;background:var(--gold-400);box-shadow:0 0 0 4px rgba(245,196,81,.12)}
  .hero h1{max-width:15ch;margin:20px 0 12px;font-size:clamp(2.2rem,7vw,4.2rem);line-height:1.2;letter-spacing:-.04em;color:var(--text);text-shadow:none}.hero h1 span{display:block;color:var(--gold-300)}.hero-sub{max-width:54ch;margin:0 0 25px;color:var(--muted);font-size:clamp(1rem,2vw,1.12rem);line-height:1.9}.hero-actions{gap:10px}
  .section-heading{margin-bottom:18px}.section-heading h2,.section-title-row h2{margin:0}.section-heading>p:last-child{margin:5px 0 0}.eyebrow{margin:0 0 4px;color:var(--purple-300);font-size:.78rem;font-weight:800;letter-spacing:.03em}.section-title-row{align-items:flex-end;margin-bottom:12px}
  .net{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border-bottom:3px solid var(--c);padding:18px 12px} .small{font-size:.85rem} .net app-net-logo { display:block }
  .feature-card{position:relative;min-height:145px}.icon-box{width:42px;height:42px;display:grid;place-items:center;flex:none;border-radius:13px;color:var(--purple-400);background:rgba(139,92,246,.13);border:1px solid rgba(167,139,250,.16)}
  .step-number{position:absolute;inset-inline-end:18px;top:17px;color:rgba(167,139,250,.55);font-size:.76rem;font-weight:800;letter-spacing:.08em}
  .cta{background:linear-gradient(135deg,rgba(22,48,88,.95),rgba(15,23,56,.9));border-color:rgba(167,139,250,.24)}
  @media(max-width:600px){.hero-actions{align-items:stretch}.hero-actions .btn{flex:1;padding-inline:12px}.section-title-row{align-items:flex-start}.all-link{font-size:.82rem}}
  `],
})
export class HomeComponent {
  s = inject(SettingsService); private api = inject(ApiService);
  nets = signal<Network[]>([]); featured = signal<Pkg[]>([]); loaded = signal(false);
  steps = [{ i: 'package' as const, t: 'اختاري الشبكة والباقة', d: 'فودافون، اتصالات، أورنج أو WE.' }, { i: 'user' as const, t: 'اكتبي بياناتك', d: 'اسمك ورقمك والرقم المطلوب تجديده.' }, { i: 'wallet' as const, t: 'ادفعي وأرفقي الإيصال', d: 'حوّلي المبلغ وأرفقي صورة الإيصال.' }, { i: 'packageSearch' as const, t: 'تابعي طلبك', d: 'راجعي حالة الطلب من صفحة طلباتي.' }];
  constructor() {
    this.api.networks().subscribe(n => this.nets.set(n));
    this.api.packages({ featured: 'true' }).subscribe({ next: p => { this.featured.set(p.slice(0, 6)); this.loaded.set(true); }, error: () => this.loaded.set(true) });
  }
}
