import { Component, Input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Network, Pkg, STATUS_LABEL, CATEGORY_LABEL, WA_STATUS_LABEL } from '../core/models';
import { fmt } from '../core/ui';
import { IconComponent } from './icon';

const NETWORK_LOGOS: Record<string, string> = {
  vodafone: '/logos/vodafone.png',
  etisalat: '/logos/etisalat.png',
  orange: '/logos/orange.png',
  we: '/logos/we.png',
};

@Component({
  selector: 'app-net-logo', standalone: true,
  template: `
    @if (logoSrc) {
      <img [src]="logoSrc" (error)="onLogoError($event)" [alt]="n.nameAr" [style.width.px]="size" [style.height.px]="size" style="object-fit:contain;border-radius:16px;background:#fff;padding:4px;box-shadow:0 10px 26px rgba(0,0,0,.18)">
    }
  `,
  styles: [`:host{display:inline-block} img{display:block}`],
})
export class NetLogoComponent {
  @Input({ required: true }) n!: Network;
  @Input() size = 48;
  get logoSrc(): string {
    if (this.n?.logoUrl) return this.n.logoUrl;
    if (this.n?.key && NETWORK_LOGOS[this.n.key]) return NETWORK_LOGOS[this.n.key];
    return this.letterLogo();
  }
  onLogoError(event: Event) {
    const img = event.target as HTMLImageElement;
    const key = this.n?.key;
    if (!key || img.dataset['fallbackDone']) { img.style.visibility = 'hidden'; return; }
    if (this.n?.logoUrl && !img.dataset['staticFallback']) {
      img.dataset['staticFallback'] = 'true';
      img.src = NETWORK_LOGOS[key] || `/logos/${key}.svg`;
      return;
    }
    if (img.src.endsWith('.png')) {
      img.src = `/logos/${key}.svg`;
      return;
    }
    img.dataset['fallbackDone'] = 'true';
    img.src = this.letterLogo();
  }
  private letterLogo(): string {
    const letter = (this.n?.nameEn || this.n?.nameAr || 'N').charAt(0).toUpperCase();
    const bg = this.n?.color || '#7c3aed';
    const fg = '#ffffff';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" rx="34" fill="${bg}"/>
        <circle cx="100" cy="100" r="64" fill="rgba(255,255,255,0.08)"/>
        <text x="100" y="120" text-anchor="middle" font-size="88" font-family="Arial, sans-serif" font-weight="800" fill="${fg}">${letter}</text>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
}

@Component({
  selector: 'app-status', standalone: true,
  imports: [IconComponent],
  template: `<span class="badge status" [class]="cls"><app-icon [name]="icon" [size]="14" />{{ label }}</span>`,
  styles: [`.status{gap:6px}.status app-icon{flex:none}`],
})
export class StatusComponent {
  @Input({ required: true }) set value(v: string) {
    this.label = STATUS_LABEL[v] || WA_STATUS_LABEL[v] || v;
    this.cls = ['activated', 'payment_confirmed', 'delivered', 'read', 'confirmed', 'manually_confirmed'].includes(v) ? 'ok' : ['rejected', 'failed', 'cancelled'].includes(v) ? 'bad' : ['processing', 'sent', 'opened'].includes(v) ? 'info' : 'warn';
    this.icon = ['activated', 'payment_confirmed', 'delivered', 'read', 'confirmed'].includes(v) ? 'circleCheck' : ['rejected', 'failed', 'cancelled'].includes(v) ? 'circleX' : ['processing', 'sent'].includes(v) ? 'refresh' : 'clock';
  }
  label = ''; cls = 'warn'; icon: 'circleCheck' | 'circleX' | 'refresh' | 'clock' = 'clock';
}

@Component({
  selector: 'app-pkg-card', standalone: true, imports: [RouterLink, IconComponent],
  template: `
  <article class="card hover pk" [style.--c]="net?.color || '#7c3aed'" [class.off]="!p.isAvailable">
    <div class="row between">
      <span class="badge" [style.borderColor]="net?.color">{{ net?.nameAr }}</span>
      <span class="row" style="gap:6px">@if (p.isFeatured) { <span class="badge featured"><app-icon name="star" [size]="13" /> مميزة</span> }
        @if (!p.isAvailable) { <span class="badge bad">غير متاحة</span> }</span>
    </div>
    @if (p.imageUrl) { <div class="pkg-image"><img [src]="p.imageUrl" [alt]="p.name" loading="lazy"></div> }
    <h3 style="margin-top:12px">{{ p.name }}</h3>
    <div class="muted small">{{ cat }} · ميعاد التجديد: {{ p.validity || 'غير مذكور' }}</div>
    <ul class="spec">
      @if (p.internetQuota) { <li><app-icon name="globe" [size]="16" /> {{ p.internetQuota }}</li> }
      @if (p.minutes) { <li><app-icon name="phone" [size]="16" /> {{ p.minutes }}</li> }
      @if (p.firstTimeFee) { <li><b>رسوم أول مرة:</b> {{ p.firstTimeFee }}</li> }
      @for (e of p.extraDetails; track e.label) { <li><span class="muted">{{ e.label }}:</span> {{ e.value }}@if (e.note) { <small class="warn-t"> ({{ e.note }})</small> }</li> }
    </ul>
    @if (p.description) { <p class="muted small">{{ p.description }}</p> }
    <div class="row between" style="margin-top:auto;padding-top:12px">
      @if (p.price != null) { <div class="price-tag"><span><app-icon name="banknote" [size]="14" /> {{ p.priceNote.includes('أول شهر') ? 'الدفع أول شهر' : 'سعر الباقة' }}</span><strong class="price">{{ fmt(p.price) }}<small>جنيه</small></strong></div> }
      @else { <div class="badge warn">سعر التفعيل قيد التأكيد</div> }
      @if (p.isBookable) { <a class="btn gold" [routerLink]="['/booking']" [queryParams]="{ package: p._id }">اطلب التجديد</a> }
      @else { <button class="btn ghost" disabled>غير متاح للحجز</button> }
    </div>
    @if (p.priceNote) { <div class="muted small warn-t" style="margin-top:8px">{{ p.priceNote }}</div> }
  </article>`,
  styles: [`.pk{display:flex;flex-direction:column;border-top:3px solid var(--c)} .pk.off{opacity:.6} .small{font-size:.85rem} .warn-t{color:var(--warn)}
  .pkg-image{height:150px;margin:12px -4px 0;overflow:hidden;border-radius:14px;background:rgba(255,255,255,.04);display:grid;place-items:center}
  .pkg-image img{width:100%;height:100%;object-fit:cover}
  .price-tag{display:grid;gap:1px;justify-items:start;padding:7px 13px;border:1px solid rgba(245,196,81,.5);border-radius:14px;background:linear-gradient(135deg,rgba(245,196,81,.15),rgba(245,196,81,.04));box-shadow:0 6px 20px rgba(245,196,81,.08)}
  .price-tag>span{font-size:.72rem;color:var(--gold-300);font-weight:800}.price-tag .price{font-size:1.75rem;line-height:1.25}
  .spec{list-style:none;padding:0;margin:10px 0 6px;display:grid;gap:8px}.spec li{display:flex;align-items:flex-start;gap:8px}.spec app-icon{flex:none;color:var(--purple-400);margin-top:3px}
  .price-tag>span{display:flex;align-items:center;gap:5px}`],
})
export class PkgCardComponent {
  @Input({ required: true }) p!: Pkg; fmt = fmt;
  get net() { return typeof this.p.network === 'object' ? this.p.network : null; }
  get cat() { return CATEGORY_LABEL[this.p.category] || this.p.category; }
}
