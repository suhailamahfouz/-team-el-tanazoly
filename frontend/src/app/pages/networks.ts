import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Network } from '../core/models';
import { NetLogoComponent } from '../shared/shared';

@Component({
  selector: 'app-networks', standalone: true, imports: [RouterLink, NetLogoComponent],
  template: `<div class="container section"><h1 style="font-size:1.8rem">الشبكات</h1><p class="muted">اختار شبكتك لعرض باقاتها.</p>
  <div class="grid g2">
    @for (n of nets(); track n._id) {
      <div class="card hover" [style.border-top]="'3px solid ' + n.color" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:18px 14px">
        <div style="display:grid;place-items:center"><app-net-logo [n]="n" [size]="60" /></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><h2 style="margin:0">{{ n.nameAr }}</h2><span class="muted">{{ n.nameEn }}</span></div>
        @if (n.description) { <p class="muted" style="margin:0">{{ n.description }}</p> }
        <a class="btn block" style="margin-top:4px;width:100%" [routerLink]="['/packages']" [queryParams]="{ network: n.key }">عرض الباقات</a>
      </div>
    } @empty { <div class="skeleton"></div><div class="skeleton"></div> }
  </div></div>`,
})
export class NetworksComponent { nets = signal<Network[]>([]); constructor() { inject(ApiService).networks().subscribe(n => this.nets.set(n)); } }
