import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Network } from '../core/models';
import { ToastService } from '../core/ui';
import { NetLogoComponent } from '../shared/shared';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-networks', standalone: true, imports: [FormsModule, NetLogoComponent, IconComponent],
  template: `<div class="row between"><h1 style="font-size:1.6rem;margin:0">الشبكات</h1><button class="btn gold sm" (click)="edit(null)"><app-icon name="plus" [size]="16" /> شبكة</button></div>
  <p class="muted">ارفع لوجو كل شبكة (الصور الرسمية من المالك). لا يتم استخدام شعارات مقلّدة.</p>
  <div class="grid g2">@for (n of list(); track n._id) { <div class="card" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:16px"><div style="display:grid;place-items:center"><app-net-logo [n]="n" [size]="52" /></div><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><b>{{ n.nameAr }}</b><span class="muted">{{ n.nameEn }}</span>@if (!n.isActive) { <span class="badge bad">متوقفة</span> }</div>
    <div class="row" style="margin-top:4px"><button class="btn ghost sm" (click)="edit(n)"><app-icon name="pencil" [size]="15" /> تعديل</button><button class="btn danger sm" (click)="del(n)"><app-icon name="trash" [size]="15" /> حذف</button></div></div> }</div>
  @if (f(); as x) { <div class="modal-bg" (click)="f.set(null)"><div class="modal" (click)="$event.stopPropagation()"><h2>{{ x._id ? 'تعديل شبكة' : 'شبكة جديدة' }}</h2>
    <div class="grid g2"><div class="field"><label>المعرّف (إنجليزي صغير)</label><input [(ngModel)]="x.key" [disabled]="!!x._id" dir="ltr"></div><div class="field"><label>اللون</label><input type="color" [(ngModel)]="x.color" style="padding:4px"></div>
      <div class="field"><label>الاسم بالعربي</label><input [(ngModel)]="x.nameAr"></div><div class="field"><label>الاسم بالإنجليزي</label><input [(ngModel)]="x.nameEn" dir="ltr"></div>
      <div class="field" style="grid-column:1/-1"><label>وصف</label><input [(ngModel)]="x.description"></div>
      <div class="field" style="grid-column:1/-1"><label>اللوجو</label><input type="file" accept="image/*" (change)="upload($event, x)">@if (x.logoUrl) { <small class="muted">تم رفع لوجو</small> }</div></div>
    <label class="row"><input type="checkbox" [(ngModel)]="x.isActive"> نشطة</label>
    <div class="row" style="margin-top:14px"><button class="btn gold grow" (click)="save(x)"><app-icon name="save" [size]="16" /> حفظ</button><button class="btn ghost" (click)="f.set(null)">إلغاء</button></div></div></div> }`,
})
export class AdminNetworksComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); list = signal<Network[]>([]); f = signal<any>(null);
  ngOnInit() { this.load(); } load() { this.api.adminNetworks().subscribe(n => this.list.set(n)); }
  edit(n: Network | null) { this.f.set(n ? { ...n } : { key: '', nameAr: '', nameEn: '', color: '#7c3aed', description: '', logoUrl: '', isActive: true, sortOrder: this.list().length + 1 }); }
  save(x: any) {
    const body = { key: x.key, nameAr: x.nameAr, nameEn: x.nameEn, color: x.color, description: x.description, logoUrl: x.logoUrl, isActive: x.isActive, sortOrder: x.sortOrder };
    this.api.saveNetwork(x._id || null, body).subscribe({ next: () => { this.toast.ok('تم الحفظ'); this.f.set(null); this.load(); }, error: e => this.toast.err(e) });
  }
  del(n: Network) { if (confirm(`حذف ${n.nameAr}؟`)) this.api.deleteNetwork(n._id).subscribe({ next: () => this.load(), error: e => this.toast.err(e) }); }
  upload(e: Event, x: any) { const file = (e.target as HTMLInputElement).files?.[0]; if (file) this.api.uploadImage(file).subscribe({ next: r => { x.logoUrl = r.url; }, error: er => this.toast.err(er) }); }
}
