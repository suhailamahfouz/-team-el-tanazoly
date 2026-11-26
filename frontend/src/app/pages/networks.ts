import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Network } from '../core/models';
import { NetLogoComponent } from '../shared/shared';
import { NETWORK_PREVIEW } from '../core/network-preview';
import { timeout } from 'rxjs';

@Component({
  selector: 'app-networks', standalone: true, imports: [RouterLink, NetLogoComponent],
  template: `<div class="container section"><h1 style="font-size:1.8rem">الشبكات</h1><p class="muted">اختار شبكتك لعرض باقاتها.</p>
  @if (preview()) { <div class="card preview" role="status"><span>عرض مبدئي للشبكات. تعذر تحميل البيانات الحالية.</span><button class="btn ghost sm" [disabled]="loading()" (click)="load()">{{ loading() ? 'جاري المحاولة...' : 'إعادة المحاولة' }}</button></div> }
  <div class="grid g2">
    @for (n of nets(); track n._id) {
      <div class="card hover" [style.border-top]="'3px solid ' + n.color" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:18px 14px">
        <div style="display:grid;place-items:center"><app-net-logo [n]="n" [size]="60" /></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><h2 style="margin:0">{{ n.nameAr }}</h2><span class="muted">{{ n.nameEn }}</span></div>
        @if (n.description) { <p class="muted" style="margin:0">{{ n.description }}</p> }
        <a class="btn block" style="margin-top:4px;width:100%" [routerLink]="['/packages']" [queryParams]="{ network: n.key }">عرض الباقات</a>
      </div>
    } @empty { @if (loading()) { <div class="skeleton"></div><div class="skeleton"></div> } @else { <div class="empty">لا توجد شبكات متاحة حاليًا.</div> } }
  </div></div>`,
  styles: [`.preview{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;font-size:.9rem}`],
})
export class NetworksComponent {
  private api = inject(ApiService); nets = signal<Network[]>([]); loading = signal(true); preview = signal(false);
  constructor() { this.load(); }
  load() { this.loading.set(true); this.api.networks().pipe(timeout(8000)).subscribe({ next: n => { this.nets.set(n); this.preview.set(false); this.loading.set(false); }, error: () => { this.nets.set(NETWORK_PREVIEW); this.preview.set(true); this.loading.set(false); } }); }
}
