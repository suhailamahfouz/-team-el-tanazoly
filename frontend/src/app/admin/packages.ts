import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { CATEGORY_LABEL, Network, Pkg } from '../core/models';
import { ToastService, fmt } from '../core/ui';
import { IconComponent } from '../shared/icon';

@Component({
  selector: 'app-admin-packages', standalone: true, imports: [FormsModule, IconComponent],
  template: `<div class="row between"><h1 style="font-size:1.6rem;margin:0">الباقات</h1><div class="row"><button class="btn ghost sm" (click)="bulkOpen.set(true)"><app-icon name="banknote" [size]="16" /> تعديل أسعار جماعي</button><button class="btn gold sm" (click)="edit(null)"><app-icon name="plus" [size]="16" /> باقة جديدة</button></div></div>
  <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>الباقة</th><th>الشبكة</th><th>التصنيف</th><th>السعر (ج)</th><th>متاحة</th><th>مميزة</th><th></th></tr></thead><tbody>
    @for (p of list(); track p._id) { <tr><td>{{ p.name }}</td><td>{{ net(p) }}</td><td>{{ cat[p.category] }}</td>
      <td><input type="number" min="0" style="width:100px;min-height:36px" [ngModel]="p.price" (change)="quickPrice(p, $any($event.target).value)" placeholder="غير محدد"></td>
      <td><input type="checkbox" [checked]="p.isAvailable" (change)="toggle(p, 'isAvailable')"></td><td><input type="checkbox" [checked]="p.isFeatured" (change)="toggle(p, 'isFeatured')"></td>
      <td><button class="btn ghost sm" (click)="edit(p)"><app-icon name="pencil" [size]="15" /> تعديل</button> <button class="btn danger sm" (click)="del(p)"><app-icon name="trash" [size]="15" /> حذف</button></td></tr> }
  </tbody></table></div>

  @if (form(); as f) { <div class="modal-bg" (click)="form.set(null)"><div class="modal" (click)="$event.stopPropagation()"><h2>{{ f._id ? 'تعديل باقة' : 'باقة جديدة' }}</h2>
    <div class="grid g2">
      <div class="field"><label>الشبكة</label><select [(ngModel)]="f.network">@for (n of nets(); track n._id) { <option [value]="n._id">{{ n.nameAr }}</option> }</select></div>
      <div class="field"><label>التصنيف</label><select [(ngModel)]="f.category">@for (c of catKeys; track c) { <option [value]="c">{{ cat[c] }}</option> }</select></div>
      <div class="field"><label>نوع الخط</label><select [(ngModel)]="f.lineType"><option value="mobile">موبايل</option><option value="landline">أرضي</option></select></div>
      <div class="field" style="grid-column:1/-1"><label>اسم الباقة</label><input [(ngModel)]="f.name"></div>
      <div class="field"><label>الإنترنت</label><input [(ngModel)]="f.internetQuota" placeholder="مثال: 20 جيجا"></div>
      <div class="field"><label>الدقائق / الفليكس</label><input [(ngModel)]="f.minutes"></div>
      <div class="field"><label>ميعاد التجديد / المدة</label><input [(ngModel)]="f.validity" placeholder="مثال: يوم 1 و16"></div>
      <div class="field"><label>رسوم أول مرة إن وجدت</label><input [(ngModel)]="f.firstTimeFee" placeholder="مثال: 50 جنيه رسوم تفعيل"></div>
      <div class="field"><label>إجمالي المطلوب دفعه أول مرة بالجنيه (اتركيه فارغًا إن لم يتأكد)</label><input type="number" min="0" [(ngModel)]="f.price"></div>
      <div class="field"><label>ترتيب الظهور (الأقل يظهر أولاً)</label><input type="number" min="0" [(ngModel)]="f.sortOrder"></div>
      <div class="field" style="grid-column:1/-1"><div class="row between"><label style="margin:0">تفاصيل إضافية للباقة</label><button type="button" class="btn ghost sm" (click)="addExtra(f)"><app-icon name="plus" [size]="15" /> إضافة تفصيلة</button></div>
        @for (detail of f.extraDetails; track $index) { <div class="extra-row"><input [(ngModel)]="detail.label" placeholder="العنوان — مثال: الرصيد الصافي"><input [(ngModel)]="detail.value" placeholder="القيمة — مثال: 123,000"><input [(ngModel)]="detail.note" placeholder="ملاحظة اختيارية"><button type="button" class="btn danger sm" aria-label="حذف التفصيلة" (click)="f.extraDetails.splice($index, 1)"><app-icon name="trash" [size]="15" /></button></div> }
        @if (!f.extraDetails?.length) { <small class="muted">أضيفي معلومات مثل الرصيد أو سعر أول شهر وسعر التجديد.</small> }
      </div>
      <div class="field" style="grid-column:1/-1"><label>ملاحظة السعر</label><input [(ngModel)]="f.priceNote"></div>
      <div class="field" style="grid-column:1/-1"><label>وصف</label><textarea [(ngModel)]="f.description"></textarea></div>
      <div class="field" style="grid-column:1/-1"><label>صورة الباقة (اختياري)</label><input type="file" accept="image/*" (change)="upload($event, f)">@if (f.imageUrl) { <small class="muted">تم رفع صورة</small> }</div>
    </div>
    <label class="row"><input type="checkbox" [(ngModel)]="f.isAvailable"> متاحة</label><label class="row"><input type="checkbox" [(ngModel)]="f.isFeatured"> مميزة</label>
    <div class="row" style="margin-top:14px"><button class="btn gold grow" (click)="save(f)">حفظ</button><button class="btn ghost" (click)="form.set(null)">إلغاء</button></div></div></div> }

  @if (bulkOpen()) { <div class="modal-bg" (click)="bulkOpen.set(false)"><div class="modal" (click)="$event.stopPropagation()"><h2>تعديل أسعار جماعي</h2>
    <p class="muted">أدخل قيمة التغيير (مثال: -20 للخصم). ستظهر معاينة قبل التطبيق، ولن يتغير أي سعر قبل التأكيد. الباقات بدون سعر محدد لا تتأثر.</p>
    <div class="grid g2"><div class="field"><label>القيمة (+/−)</label><input type="number" [(ngModel)]="delta"></div>
      <div class="field"><label>الشبكة (اختياري)</label><select [(ngModel)]="bulkNet"><option value="">كل الشبكات</option>@for (n of nets(); track n._id) { <option [value]="n._id">{{ n.nameAr }}</option> }</select></div></div>
    <button class="btn ghost" [disabled]="!delta" (click)="preview()">معاينة</button>
    @if (changes().length) { <div class="table-wrap" style="margin:12px 0"><table><thead><tr><th>الباقة</th><th>من</th><th>إلى</th></tr></thead><tbody>@for (c of changes(); track c.id) { <tr><td>{{ c.name }}</td><td>{{ c.from }}</td><td class="gold">{{ c.to }}</td></tr> }</tbody></table></div>
      <button class="btn danger block" (click)="apply()">تطبيق على {{ changes().length }} باقة</button> }
    <button class="btn ghost block" style="margin-top:8px" (click)="bulkOpen.set(false)">إغلاق</button></div></div> }`,
  styles: [`.extra-row{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:center;margin-top:8px;padding:9px;border:1px solid var(--line);border-radius:12px;background:rgba(7,11,28,.25)}.extra-row input{min-width:0}.extra-row .btn{min-width:38px;padding-inline:10px}@media(max-width:640px){.extra-row{grid-template-columns:1fr 1fr auto}.extra-row input:nth-child(3){grid-column:1/3;grid-row:2}}`],
})
export class AdminPackagesComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  cat = CATEGORY_LABEL; catKeys = Object.keys(CATEGORY_LABEL); list = signal<Pkg[]>([]); nets = signal<Network[]>([]); form = signal<any>(null);
  bulkOpen = signal(false); delta = 0; bulkNet = ''; changes = signal<{ id: string; name: string; from: number; to: number }[]>([]);
  ngOnInit() { this.api.adminNetworks().subscribe(n => this.nets.set(n)); this.load(); }
  load() { this.api.adminPackages().subscribe(p => this.list.set(p)); }
  net(p: Pkg) { return typeof p.network === 'object' ? p.network.nameAr : ''; }
  edit(p: Pkg | null) { this.form.set(p ? { ...p, lineType: p.lineType || 'mobile', network: typeof p.network === 'object' ? p.network._id : p.network, extraDetails: (p.extraDetails || []).map(x => ({ ...x })) } : { network: this.nets()[0]?._id, category: 'internet', lineType: 'mobile', name: '', internetQuota: '', minutes: '', validity: '', price: null, priceNote: '', description: '', extraDetails: [], isAvailable: true, isFeatured: false, imageUrl: '', sortOrder: this.list().length + 1 }); }
  addExtra(f: any) { f.extraDetails ||= []; f.extraDetails.push({ label: '', value: '', note: '' }); }
  body(f: any) {
    const { network, name, category, lineType, internetQuota, minutes, validity, firstTimeFee, description, priceNote, isAvailable, isFeatured, imageUrl, extraDetails, sortOrder } = f;
    return { network, name, category, lineType, internetQuota, minutes, validity, firstTimeFee: firstTimeFee || '', description, priceNote, isAvailable, isFeatured, imageUrl, extraDetails, sortOrder: Number(sortOrder || 0), price: f.price === '' || f.price == null ? null : Number(f.price) };
  }
  save(f: any) { this.api.savePackage(f._id || null, this.body(f)).subscribe({ next: () => { this.toast.ok('تم الحفظ'); this.form.set(null); this.load(); }, error: e => this.toast.err(e) }); }
  quickPrice(p: Pkg, v: string) { this.api.savePackage(p._id, { price: v === '' ? null : Number(v) }).subscribe({ next: () => { this.toast.ok('تم تحديث السعر'); this.load(); }, error: e => { this.toast.err(e); this.load(); } }); }
  toggle(p: Pkg, k: 'isAvailable' | 'isFeatured') { this.api.savePackage(p._id, { [k]: !p[k] }).subscribe({ next: () => this.load(), error: e => this.toast.err(e) }); }
  del(p: Pkg) { if (confirm(`حذف "${p.name}"؟ الطلبات السابقة لن تتأثر.`)) this.api.deletePackage(p._id).subscribe({ next: () => { this.toast.ok('تم الحذف'); this.load(); }, error: e => this.toast.err(e) }); }
  upload(e: Event, f: any) { const file = (e.target as HTMLInputElement).files?.[0]; if (file) this.api.uploadImage(file).subscribe({ next: r => { f.imageUrl = r.url; this.toast.ok('تم رفع الصورة'); }, error: er => this.toast.err(er) }); }
  preview() { this.api.bulkPrice({ delta: Number(this.delta), network: this.bulkNet || undefined, dryRun: true }).subscribe({ next: r => this.changes.set(r.changes), error: e => this.toast.err(e) }); }
  apply() { this.api.bulkPrice({ delta: Number(this.delta), network: this.bulkNet || undefined, dryRun: false }).subscribe({ next: r => { this.toast.ok(`تم تعديل ${r.count} باقة`); this.changes.set([]); this.bulkOpen.set(false); this.load(); }, error: e => this.toast.err(e) }); }
}
