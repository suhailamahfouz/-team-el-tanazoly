import { Injectable, signal, inject } from '@angular/core';
import { Settings } from './models';
import { ApiService } from './api.service';
import { WarmupService } from './warmup';

@Injectable({ providedIn: 'root' })
export class ToastService {
  items = signal<{ id: number; text: string; kind: 'ok' | 'err' }[]>([]); private n = 0;
  show(text: string, kind: 'ok' | 'err' = 'ok') { const id = ++this.n; this.items.update(a => [...a, { id, text, kind }]); setTimeout(() => this.items.update(a => a.filter(x => x.id !== id)), 4200); }
  ok = (t: string) => this.show(t, 'ok');
  err(e: any) { this.show(e?.error?.errors?.[0]?.message || e?.error?.message || 'حدث خطأ، حاول مرة أخرى', 'err'); }
}
@Injectable({ providedIn: 'root' })
export class SettingsService {
  data = signal<Settings | null>(null);
  private api = inject(ApiService);
  constructor() { this.load(); inject(WarmupService).recovered.subscribe(() => { if (!this.data()) this.load(); }); }
  private load() { this.api.settings().subscribe({ next: s => this.data.set(s), error: () => {} }); }
  waLink(text = '') { const n = (this.data()?.contact?.whatsapp || '01121844925').replace(/\D/g, ''); const w = n.startsWith('0') ? '2' + n : n; return w ? `https://wa.me/${w}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; }
}
export const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('ar-EG').format(n);
export const fmtDate = (d: string) => new Date(d).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
