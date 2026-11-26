import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/ui';
import { IconComponent } from './shared/icon';
import { ThemeService } from './core/theme';
import { WarmupService } from './core/warmup';

@Component({
  selector: 'app-root', standalone: true, imports: [RouterOutlet, IconComponent],
  template: `@if (warmup.visible()) {
    <main class="warmup" role="status" aria-live="polite"><div class="warmup-content">
      <img class="warmup-logo" src="/logos/Logo1.jpeg" alt="شعار تيم النزلاوي">
      <h1>تيم النزلاوي</h1><p class="tagline">عالم العروض</p>
      <div class="networks" aria-hidden="true">@for (network of warmup.networks; track network.name; let i = $index) {
        <div class="network" [class.active]="warmup.active() % warmup.networks.length === i"><img [src]="network.logo" alt=""><span>{{ network.name }}</span></div>
      }</div>
      <p class="message">{{ warmup.messages[warmup.active() % warmup.messages.length] }}</p>
      <div class="progress" aria-hidden="true"><span></span></div>
      <p class="hint">أول تحميل ممكن ياخد وقت، بعدها الموقع هيبقى أسرع.</p>
    </div></main>
  } @else if (warmup.ready()) { <router-outlet /> }
  <div class="toasts">@for (t of toast.items(); track t.id) { <div class="toast" [class]="t.kind"><app-icon [name]="t.kind === 'ok' ? 'circleCheck' : 'circleX'" [size]="18" />{{ t.text }}</div> }</div>`,
  styles: [`.warmup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;overflow:auto;padding:24px;color:#f6f4ff;background:radial-gradient(ellipse at 80% 18%,rgba(90,43,174,.28),transparent 43%),radial-gradient(ellipse at 12% 85%,rgba(202,150,44,.06),transparent 38%),#090f24}.warmup-content{width:min(100%,420px);text-align:center}.warmup-logo{width:104px;height:104px;object-fit:cover;border-radius:24px;border:1px solid rgba(246,200,92,.45);box-shadow:0 0 32px rgba(161,90,255,.28);background:#070b1b}.warmup h1{font-size:clamp(1.8rem,7vw,2.3rem);margin:25px 0 0;color:#f4c557;line-height:1.3}.tagline{margin:0;color:#b8a1f1;font-size:.92rem;font-weight:700}.networks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:38px auto 27px;max-width:350px}.network{display:grid;justify-items:center;align-content:center;gap:8px;min-height:88px;padding:10px 4px;border:1px solid rgba(185,175,230,.12);border-radius:16px;background:rgba(255,255,255,.025);color:#aaaac2;font-size:.75rem;font-weight:700;transition:transform .4s,border-color .4s,background .4s,box-shadow .4s}.network img{width:44px;height:44px;object-fit:contain;border-radius:7px;background:#fff;padding:3px}.network.active{transform:translateY(-8px);border-color:rgba(244,197,87,.65);background:rgba(139,92,246,.14);box-shadow:0 0 24px rgba(139,92,246,.22);color:#fff}.message{min-height:30px;margin:0 0 14px;color:#e3d9ff;font-size:.92rem}.progress{position:relative;height:6px;max-width:280px;margin:auto;overflow:hidden;border-radius:8px;background:rgba(255,255,255,.12)}.progress span{position:absolute;inset-block:0;width:35%;border-radius:inherit;background:linear-gradient(90deg,#a78bfa,#f4c557);animation:loading 1.6s ease-in-out infinite}.hint{margin:25px auto 0;color:#a9adc2;font-size:.78rem;line-height:1.8}@keyframes loading{0%{transform:translateX(-110%)}100%{transform:translateX(390%)}}@media(max-width:360px){.networks{gap:6px}.network img{width:38px;height:38px}.warmup-logo{width:90px;height:90px}}@media(prefers-reduced-motion:reduce){.network{transition:none}.progress span{animation:none;inset-inline-start:32%}}`],
})
export class AppComponent { toast = inject(ToastService); warmup = inject(WarmupService); private theme = inject(ThemeService); constructor() { this.warmup.start(); } }
