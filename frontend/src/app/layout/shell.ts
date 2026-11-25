import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsService } from '../core/ui';
import { IconComponent, IconName } from '../shared/icon';
import { ThemeService } from '../core/theme';
import { AccountService } from '../core/account';
import { AuthService } from '../core/auth';

@Component({
  selector: 'app-shell', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
  <header class="top"><div class="container row between">
    <a routerLink="/" class="brand">
      <img class="brand-logo" [src]="s.data()?.logoUrl || '/logos/Logo1.jpeg'" alt="شعار تيم النزلاوي">
      <span><b class="brand-title">{{ brandName() }}</b><small>عالم العروض</small></span>
    </a>
    <nav class="desk">
      @for (l of links; track l.to) { <a [routerLink]="l.to" routerLinkActive="act" [routerLinkActiveOptions]="{ exact: l.to === '/' }">{{ l.t }}</a> }
    </nav>
    <button class="theme-toggle" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.mode() === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'" [title]="theme.mode() === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'"><app-icon [name]="theme.mode() === 'light' ? 'moon' : 'sun'" [size]="18" /></button>
    <a class="account-link" [routerLink]="account.user() || auth.admin() ? '/account' : '/login'"><app-icon name="user" [size]="17" /> <span>{{ account.user() || auth.admin() ? 'حسابي' : 'دخول' }}</span></a>
    @if (wa()) { <a class="btn gold sm header-wa" [href]="wa()" target="_blank" rel="noopener"><app-icon name="message" [size]="17" /> واتساب</a> }
  </div></header>
  <main><router-outlet /></main>
  <footer class="foot"><div class="container center">
    <p class="glow-title" style="font-weight:800;font-size:1.2rem">{{ brandName() }}</p>
    <p class="muted">{{ s.data()?.tagline }}</p>
    <p class="muted small">© {{ year }} جميع الحقوق محفوظة</p>
  </div></footer>
  <nav class="bottom">
    @for (l of mobile; track l.to) { <a [routerLink]="l.to" routerLinkActive="act" [routerLinkActiveOptions]="{ exact: l.to === '/' }"><span class="nav-icon"><app-icon [name]="l.i" [size]="21" /></span><span>{{ l.t }}</span></a> }
  </nav>`,
  styles: [`
  .top{position:sticky;top:0;z-index:50;background:var(--header-bg,rgba(10,15,36,.78));backdrop-filter:blur(14px);border-bottom:1px solid var(--line);padding:10px 0;padding-top:max(10px,env(safe-area-inset-top))}
  .brand{display:flex;align-items:center;gap:11px;line-height:1.1;min-width:0}.brand>span:last-child{min-width:0}.brand small{display:block;color:var(--muted);font-size:.72rem;letter-spacing:.015em}.brand b{font-size:1.13rem}
  .brand-logo{width:44px;height:44px;object-fit:contain;flex:none;border-radius:13px;background:#fff;padding:3px;box-shadow:0 4px 14px rgba(2,6,23,.12)}
  .brand-title{color:var(--text);font-weight:800;letter-spacing:-.025em}
  .brand-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;color:var(--purple-400);background:rgba(139,92,246,.12);border:1px solid rgba(167,139,250,.2)}
  .theme-toggle{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:12px;background:var(--surface-1);color:var(--navy-700);cursor:pointer;transition:background .2s,border-color .2s,color .2s}.theme-toggle:hover{border-color:var(--purple-400);color:var(--purple-600)}
  .account-link{display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border:1px solid var(--line);border-radius:11px;font-size:.85rem;font-weight:700}.account-link:hover{color:var(--purple-600)}
  .desk{display:none;gap:4px;a{padding:8px 14px;border-radius:12px;font-weight:600;color:var(--muted);transition:.2s;&:hover{color:#fff;background:rgba(255,255,255,.04)}&.act{background:rgba(124,58,237,.2);color:var(--purple-400)}}}
  @media(min-width:900px){.desk{display:flex}.bottom{display:none!important}main{padding-bottom:0!important}}
  main{min-height:70vh;padding-bottom:calc(var(--bottom-nav) + 20px)}
  .foot{border-top:1px solid var(--line);padding:28px 0 calc(var(--bottom-nav) + 24px)} .small{font-size:.85rem}
  @media(min-width:900px){.foot{padding-bottom:28px}}
  .bottom{position:fixed;inset-inline:0;bottom:0;z-index:60;min-height:calc(68px + env(safe-area-inset-bottom));padding:7px 8px calc(7px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(6,minmax(0,1fr));background:var(--nav-bg,rgba(8,13,31,.96));backdrop-filter:blur(18px);border-top:1px solid var(--line);box-shadow:0 -10px 32px rgba(0,0,0,.08);
   a{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0;color:var(--muted);font-size:.68rem;font-weight:600;transition:color .2s ease;
     .nav-icon{width:42px;height:32px;display:grid;place-items:center;border-radius:12px;transition:background .22s ease,transform .22s ease,color .22s ease}
     &.act{color:var(--purple-300);.nav-icon{color:var(--purple-300);background:rgba(139,92,246,.17);transform:translateY(-2px)}&::before{content:'';position:absolute;top:-7px;width:22px;height:2px;border-radius:2px;background:var(--purple-400)}}
   }}
  @media(min-width:900px){.bottom{display:none!important}}
  @media(max-width:600px){.header-wa{display:none}.account-link{padding:8px}.brand small{display:none}.top .row{gap:7px}}
  `],
})
export class ShellComponent {
  s = inject(SettingsService); year = new Date().getFullYear();
  theme = inject(ThemeService); account = inject(AccountService); auth = inject(AuthService);
  constructor() { this.account.restore(); }
  brandName = () => (this.s.data()?.businessName || 'تيم النزلاوي').replace(/\s*\u{1F451}/gu, '');
  wa = () => this.s.waLink('أهلاً، عايز أستفسر عن باقة');
  links = [{ to: '/', t: 'الرئيسية' }, { to: '/networks', t: 'الشبكات' }, { to: '/packages', t: 'الباقات' }, { to: '/booking', t: 'اطلب التجديد' }, { to: '/orders', t: 'طلباتي' }, { to: '/contact', t: 'تواصل معنا' }];
  mobile: { to: string; t: string; i: IconName }[] = [{ to: '/', t: 'الرئيسية', i: 'house' }, { to: '/packages', t: 'الباقات', i: 'package' }, { to: '/booking', t: 'احجز', i: 'shoppingBag' }, { to: '/orders', t: 'طلباتي', i: 'receipt' }, { to: '/contact', t: 'تواصل', i: 'message' }, { to: '/account', t: 'حسابي', i: 'user' }];
}
