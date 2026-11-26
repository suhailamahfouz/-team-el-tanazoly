import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Network, Pkg } from '../core/models';
import { SettingsService } from '../core/ui';
import { NetLogoComponent, PkgCardComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';
import { NETWORK_PREVIEW } from '../core/network-preview';
import { timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WarmupService } from '../core/warmup';

@Component({
  selector: 'app-home-discovery', standalone: true, imports: [RouterLink, NetLogoComponent, PkgCardComponent, IconComponent],
  template: `<section class="intro"><div class="container"><p class="eyebrow">تيم النزلاوي · تجديد الباقات</p>
    <h1>باقتك، بخطوات بسيطة</h1><p>اختار الشركة ونوع الخط، وشوف العروض المتاحة ليك.</p>
    <a class="btn gold" href="#choose">اختار باقتك</a>
  </div></section>
  <section id="choose" class="container section"><div class="heading"><span>١</span><div><h2>اختار الشركة</h2><p class="muted">الشركة الخاصة بالخط المطلوب تجديده</p></div></div>
    @if (networkPreview()) { <div class="preview-notice" role="status"><span>عرض مبدئي للشبكات. تعذر تحميل البيانات الحالية.</span><button type="button" [disabled]="networksLoading()" (click)="loadNetworks()">{{ networksLoading() ? 'جاري المحاولة...' : 'إعادة المحاولة' }}</button></div> }
    <div class="company-grid">@for (n of nets(); track n._id) {
      <button class="company" [class.selected]="network()?._id === n._id" [style.--company]="n.color" [attr.aria-pressed]="network()?._id === n._id" (click)="choose(n)">
        <span class="company-logo"><app-net-logo [n]="n" [size]="50" /></span><span class="company-name"><b>{{ n.nameAr }}</b><small>{{ n.nameEn }}</small></span><app-icon class="company-arrow" name="arrowLeft" [size]="18" />
      </button>
    } @empty { @if (networksLoading()) { @for (i of [1,2,3,4]; track i) { <div class="skeleton company-skeleton"></div> } } @else { <div class="empty">لا توجد شبكات متاحة حاليًا.</div> } }</div>
    @if (network(); as n) {
      <div class="heading type-heading"><span>٢</span><div><h2>اختار نوع الخط</h2><p class="muted">عروض {{ n.nameAr }}</p></div></div>
      <div class="type-row"><button class="type" [class.active]="lineType() === 'mobile'" (click)="lineType.set('mobile')">موبايل</button><button class="type" [class.active]="lineType() === 'landline'" (click)="lineType.set('landline')">أرضي</button></div>
      @if (lineType()) { <div class="heading type-heading"><span>٣</span><div><h2>الباقات</h2><p class="muted">الأسعار والتفاصيل حسب الإعلان، ويُراجع الطلب وإثبات الدفع قبل التنفيذ.</p></div></div>
        <div class="grid g2">@for (p of filtered(); track p._id) { <app-pkg-card [p]="p" /> } @empty { @if (loading()) { <div class="skeleton"></div> } @else if (packagesError()) { <div class="card unavailable" role="status"><b>الباقات غير متاحة للعرض دلوقتي</b><p class="muted">تعذر تحميل الأسعار والتفاصيل. حاول مرة تانية أو تواصل معنا.</p><button class="btn ghost sm" (click)="loadPackages(n)">إعادة المحاولة</button></div> } @else { <div class="empty">مفيش عروض متاحة للنوع ده حاليًا.</div> } }</div>
      }
    }
    <div class="help"><div><h2>محتاج مساعدة؟</h2><p class="muted">كلمنا على واتساب وهنساعدك تختار.</p></div><a class="btn ghost" [href]="s.waLink('أهلاً، عايز أستفسر عن باقة')" target="_blank" rel="noopener">تواصل واتساب</a></div>
  </section>`,
  styles: [`.intro{padding:68px 0;background:linear-gradient(125deg,#f3f6ff,#fff);border-bottom:1px solid var(--line)}.intro h1{max-width:650px;color:#172749}.intro p{color:#5d6d84}.intro .eyebrow{font-size:.9rem;font-weight:800;color:#6941bf}.intro .btn{margin-top:12px}.heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.heading span{display:grid;place-items:center;flex:none;width:36px;height:36px;background:#ece9ff;color:#6845ba;border-radius:12px;font-weight:800}.heading h2{margin:0}.heading p{margin:2px 0}.company-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.company{position:relative;min-height:150px;overflow:hidden;background:var(--surface-card);color:var(--text);border:1px solid var(--line);border-bottom:4px solid var(--company);border-radius:18px;padding:18px 15px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;text-align:start;cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}.company:hover{transform:translateY(-3px);box-shadow:var(--shadow)}.company.selected{outline:2px solid var(--company);outline-offset:2px}.company-logo{display:grid;place-items:center}.company-name{display:grid;gap:1px}.company-name b{font-size:1rem}.company-name small{color:var(--muted);font-size:.78rem;direction:ltr;text-align:start}.company-arrow{position:absolute;inset-inline-end:16px;bottom:20px;color:var(--company)}.company-skeleton{min-height:150px}.preview-notice{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 15px;margin-bottom:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface-1);color:var(--muted);font-size:.88rem}.preview-notice button{border:0;background:none;color:var(--purple-600);font:inherit;font-weight:800;cursor:pointer}.unavailable{grid-column:1/-1;padding:20px}.unavailable p{margin:5px 0 12px}.type-heading{margin-top:36px}.type-row{display:flex;gap:10px}.type{min-width:125px;padding:11px 25px;border:1px solid var(--line);border-radius:13px;background:var(--surface-card);color:var(--text);font-weight:700;cursor:pointer}.type.active{background:#6743bb;color:white}.help{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:40px;padding:20px;border-radius:18px;background:var(--surface-1)}.help h2,.help p{margin:0}.help a{flex:none}@media(max-width:600px){.intro{padding:42px 0}.company-grid{grid-template-columns:repeat(2,1fr)}.company{min-height:135px;padding:14px}.help{align-items:flex-start;flex-direction:column}.help a{width:100%}.type{flex:1}}`],
})
export class HomeDiscoveryComponent {
  private api = inject(ApiService); private warmup = inject(WarmupService); private destroyRef = inject(DestroyRef); s = inject(SettingsService);
  nets = signal<Network[]>([]); network = signal<Network | null>(null); lineType = signal<'mobile' | 'landline' | ''>('');
  packages = signal<Pkg[]>([]); loading = signal(false); packagesError = signal(false); networkPreview = signal(false); networksLoading = signal(true);
  constructor() { this.loadNetworks(); this.warmup.recovered.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { if (this.networkPreview()) this.loadNetworks(); else if (this.packagesError() && this.network()) this.loadPackages(this.network()!); }); }
  loadNetworks() { this.networksLoading.set(true); this.api.networks().pipe(timeout(8000)).subscribe({ next: n => { const selected = this.network(); const match = selected && n.find(x => x.key === selected.key); this.nets.set(n); this.networkPreview.set(false); this.networksLoading.set(false); this.network.set(match || null); if (selected && !match) { this.lineType.set(''); this.packages.set([]); } else if (match && this.packagesError()) this.loadPackages(match); }, error: () => { this.nets.set(NETWORK_PREVIEW); this.networkPreview.set(true); this.networksLoading.set(false); } }); }
  choose(n: Network) { this.network.set(n); this.lineType.set(''); this.packages.set([]); this.loadPackages(n); }
  loadPackages(n: Network) { this.loading.set(true); this.packagesError.set(false); this.api.packages({ network: n.key }).pipe(timeout(8000)).subscribe({ next: p => { if (this.network()?._id === n._id) { this.packages.set(p); this.loading.set(false); } }, error: () => { if (this.network()?._id === n._id) { this.packages.set([]); this.loading.set(false); this.packagesError.set(true); } } }); }
  filtered() { return this.packages().filter(p => (p.lineType || 'mobile') === this.lineType()); }
}
