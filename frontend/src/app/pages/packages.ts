import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { Network, Pkg } from '../core/models';
import { PkgCardComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';
import { NETWORK_PREVIEW } from '../core/network-preview';

@Component({
  selector: 'app-packages', standalone: true, imports: [FormsModule, PkgCardComponent, IconComponent],
  template: `<div class="container section">
    <h1 style="font-size:1.8rem">الباقات</h1>
    @if (networkPreview()) { <p class="muted" role="status">أسماء الشبكات للعرض المبدئي؛ تعذر تحميل بيانات الشبكات الحالية.</p> }
    <div class="stack">
      <label class="search-field"><app-icon name="search" [size]="18" /><input type="search" placeholder="ابحث باسم الباقة..." [(ngModel)]="q" (ngModelChange)="search$.next()"></label>
      <div class="chips">
        <button class="chip" [class.on]="!network" (click)="set('network', '')">كل الشبكات</button>
        @for (n of nets(); track n._id) { <button class="chip" [class.on]="network === n.key" (click)="set('network', n.key)">{{ n.nameAr }}</button> }
      </div>
      <div class="chips">
        @for (c of cats; track c.k) { <button class="chip" [class.on]="category === c.k" (click)="set('category', c.k)">{{ c.t }}</button> }
      </div>
      <div class="row between"><span class="muted">{{ list().length }} باقة</span>
        <select style="width:auto;min-width:170px" [(ngModel)]="sort" (ngModelChange)="load()"><option value="">الترتيب: المميزة أولاً</option><option value="price_asc">السعر: الأقل</option><option value="price_desc">السعر: الأعلى</option><option value="newest">الأحدث</option></select></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      @if (loading()) { @for (i of [1,2,3]; track i) { <div class="skeleton" style="min-height:230px"></div> } }
        @else if (loadError()) { <div class="card empty" style="grid-column:1/-1" role="status"><span>تعذر تحميل الباقات والأسعار حاليًا.</span><button class="btn ghost sm" (click)="load()">إعادة المحاولة</button></div> }
        @else { @for (p of list(); track p._id) { <app-pkg-card [p]="p" /> } @empty { <div class="empty" style="grid-column:1/-1"><app-icon name="packageSearch" [size]="28" /><span>لا توجد باقات مطابقة</span></div> } }
    </div></div>`,
      styles: [`.search-field{position:relative;display:block}.search-field app-icon{position:absolute;inset-inline-start:14px;top:14px;color:var(--muted);pointer-events:none}.search-field input{padding-inline-start:42px}.empty{display:flex;flex-direction:column;align-items:center;gap:10px}`],
})
export class PackagesComponent implements OnInit {
  private api = inject(ApiService); private route = inject(ActivatedRoute); private router = inject(Router); private d = inject(DestroyRef);
  nets = signal<Network[]>([]); list = signal<Pkg[]>([]); loading = signal(true); loadError = signal(false); networkPreview = signal(false); private requestId = 0;
  q = ''; network = ''; category = ''; sort = ''; search$ = new Subject<void>();
  cats = [{ k: '', t: 'كل الباقات' }, { k: 'internet', t: 'إنترنت فقط' }, { k: 'minutes_internet', t: 'دقائق + إنترنت' }, { k: 'special', t: 'عروض خاصة' }, { k: 'flex', t: 'فليكس' }, { k: 'lines', t: 'خطوط' }, { k: 'service', t: 'خدمات' }];
  ngOnInit() {
    this.api.networks().pipe(timeout(8000)).subscribe({ next: n => { this.nets.set(n); this.networkPreview.set(false); }, error: () => { this.nets.set(NETWORK_PREVIEW); this.networkPreview.set(true); } });
    this.network = this.route.snapshot.queryParamMap.get('network') || '';
    this.search$.pipe(debounceTime(300), takeUntilDestroyed(this.d)).subscribe(() => this.load());
    this.load();
  }
  set(k: 'network' | 'category', v: string) { this[k] = v; this.router.navigate([], { queryParams: { network: this.network || null }, replaceUrl: true }); this.load(); }
  load() {
    const id = ++this.requestId; this.loading.set(true); this.loadError.set(false);
    this.api.packages({ q: this.q, network: this.network, category: this.category, sort: this.sort }).pipe(timeout(8000)).subscribe({ next: p => { if (id === this.requestId) { this.list.set(p); this.loading.set(false); } }, error: () => { if (id === this.requestId) { this.list.set([]); this.loading.set(false); this.loadError.set(true); } } });
  }
}
