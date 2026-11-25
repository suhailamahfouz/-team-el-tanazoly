import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Network, Pkg } from '../core/models';
import { SettingsService } from '../core/ui';
import { NetLogoComponent, PkgCardComponent } from '../shared/shared';

@Component({
  selector: 'app-home-discovery', standalone: true, imports: [RouterLink, NetLogoComponent, PkgCardComponent],
  template: `<section class="intro"><div class="container"><p class="eyebrow">تيم النزلاوي · تجديد الباقات</p>
    <h1>باقتك، بخطوات بسيطة</h1><p>اختار الشركة ونوع الخط، وشوف العروض المتاحة ليك.</p>
    <a class="btn gold" href="#choose">اختار باقتك</a>
  </div></section>
  <section id="choose" class="container section"><div class="heading"><span>١</span><div><h2>اختار الشركة</h2><p class="muted">الشركة الخاصة بالخط المطلوب تجديده</p></div></div>
    <div class="company-grid">@for (n of nets(); track n._id) {
      <button class="company" [class.selected]="network()?._id === n._id" [style.--company]="n.color" (click)="choose(n)"><app-net-logo [n]="n" [size]="44" /><b>{{ n.nameAr }}</b></button>
    }</div>
    @if (network(); as n) {
      <div class="heading type-heading"><span>٢</span><div><h2>اختار نوع الخط</h2><p class="muted">عروض {{ n.nameAr }}</p></div></div>
      <div class="type-row"><button class="type" [class.active]="lineType() === 'mobile'" (click)="lineType.set('mobile')">موبايل</button><button class="type" [class.active]="lineType() === 'landline'" (click)="lineType.set('landline')">أرضي</button></div>
      @if (lineType()) { <div class="heading type-heading"><span>٣</span><div><h2>الباقات</h2><p class="muted">الأسعار والتفاصيل حسب الإعلان، وتُراجع صلاحية العرض قبل الدفع.</p></div></div>
        <div class="grid g2">@for (p of filtered(); track p._id) { <app-pkg-card [p]="p" /> } @empty { @if (loading()) { <div class="skeleton"></div> } @else { <div class="empty">مفيش عروض متاحة للنوع ده حاليًا.</div> } }</div>
      }
    }
    <div class="help"><div><h2>محتاج مساعدة؟</h2><p class="muted">كلمنا على واتساب وهنساعدك تختار.</p></div><a class="btn ghost" [href]="s.waLink('أهلاً، عايز أستفسر عن باقة')" target="_blank" rel="noopener">تواصل واتساب</a></div>
  </section>`,
  styles: [`.intro{padding:68px 0;background:linear-gradient(125deg,#f3f6ff,#fff);border-bottom:1px solid var(--line)}.intro h1{max-width:650px;color:#172749}.intro p{color:#5d6d84}.intro .eyebrow{font-size:.9rem;font-weight:800;color:#6941bf}.intro .btn{margin-top:12px}.heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.heading span{display:grid;place-items:center;flex:none;width:36px;height:36px;background:#ece9ff;color:#6845ba;border-radius:12px;font-weight:800}.heading h2{margin:0}.heading p{margin:2px 0}.company-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.company{background:var(--surface-card);color:var(--text);border:1px solid var(--line);border-bottom:4px solid var(--company);border-radius:16px;padding:18px 8px;display:grid;justify-items:center;gap:7px;cursor:pointer}.company.selected{outline:2px solid var(--company);outline-offset:2px}.type-heading{margin-top:36px}.type-row{display:flex;gap:10px}.type{min-width:125px;padding:11px 25px;border:1px solid var(--line);border-radius:13px;background:var(--surface-card);color:var(--text);font-weight:700;cursor:pointer}.type.active{background:#6743bb;color:white}.help{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:40px;padding:20px;border-radius:18px;background:var(--surface-1)}.help h2,.help p{margin:0}.help a{flex:none}@media(max-width:600px){.intro{padding:42px 0}.company-grid{grid-template-columns:repeat(2,1fr)}.company{padding:14px 8px}.help{align-items:flex-start;flex-direction:column}.help a{width:100%}.type{flex:1}}`],
})
export class HomeDiscoveryComponent {
  private api = inject(ApiService); s = inject(SettingsService);
  nets = signal<Network[]>([]); network = signal<Network | null>(null); lineType = signal<'mobile' | 'landline' | ''>('');
  packages = signal<Pkg[]>([]); loading = signal(false);
  constructor() { this.api.networks().subscribe(n => this.nets.set(n)); }
  choose(n: Network) { this.network.set(n); this.lineType.set(''); this.packages.set([]); this.loading.set(true); this.api.packages({ network: n.key }).subscribe({ next: p => { if (this.network()?._id === n._id) { this.packages.set(p); this.loading.set(false); } }, error: () => this.loading.set(false) }); }
  filtered() { return this.packages().filter(p => (p.lineType || 'mobile') === this.lineType()); }
}
