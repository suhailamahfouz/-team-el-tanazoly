import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth';
import { ToastService } from '../core/ui';
import { IconComponent, IconName } from '../shared/icon';
import { ThemeService } from '../core/theme';

@Component({
  selector: 'app-admin-login', standalone: true, imports: [ReactiveFormsModule, IconComponent],
  template: `<div class="container admin-login-page">
    <div class="login-mark"><app-icon name="radio" [size]="30" /></div><h1 class="center glow-title" style="font-size:1.7rem">لوحة تحكم تيم النزلاوي</h1>
    <form class="card stack admin-login-form" [formGroup]="f" (ngSubmit)="go()">
      <div class="field"><label>البريد الإلكتروني</label><input type="email" formControlName="email" autocomplete="username" dir="ltr"></div>
      <div class="field"><label>كلمة المرور</label><input type="password" formControlName="password" autocomplete="current-password" dir="ltr"></div>
      <button class="btn gold block" [disabled]="f.invalid">دخول</button>
    </form></div>`,
  styles: [`:host{display:block;min-height:100dvh}.admin-login-page{max-width:440px;padding-top:clamp(28px,10vh,96px);padding-bottom:32px}.login-mark{width:64px;height:64px;margin:0 auto 12px;display:grid;place-items:center;border:1px solid rgba(167,139,250,.22);border-radius:20px;color:var(--purple-400);background:rgba(139,92,246,.12)}.admin-login-form{width:100%;margin-top:16px}@media(max-width:600px){.admin-login-page{padding-inline:18px;padding-top:max(24px,7vh)}.admin-login-page h1{font-size:1.45rem!important}}`],
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private toast = inject(ToastService);
  f = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  go() { this.auth.login(this.f.value.email!, this.f.value.password!).subscribe({ next: () => this.router.navigate(['/admin']), error: e => this.toast.err(e) }); }
}

@Component({
  selector: 'app-admin-layout', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `<div class="wrap">
    <header class="mobile-header">
      <button class="menu-toggle" type="button" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-controls="admin-sidebar" aria-label="فتح قائمة الإدارة"><span></span><span></span><span></span></button>
      <div><b>لوحة الإدارة</b><small>تيم النزلاوي</small></div>
    </header>
    @if (menuOpen()) { <button class="backdrop" type="button" aria-label="إغلاق قائمة الإدارة" (click)="menuOpen.set(false)"></button> }
    <aside id="admin-sidebar" [class.open]="menuOpen()">
      <div class="side-head"><div class="brand-mark"><app-icon name="shield" [size]="20" /></div><div class="brand"><b>لوحة الإدارة</b><small>تيم النزلاوي</small></div><button class="close-menu" type="button" aria-label="إغلاق القائمة" (click)="menuOpen.set(false)"><app-icon name="circleX" [size]="20" /></button></div>
      <div class="nav-label">القائمة الرئيسية</div>
      <nav aria-label="قائمة الإدارة">@for (l of links(); track l.to) { <a [routerLink]="l.to" routerLinkActive="act" [routerLinkActiveOptions]="{ exact: l.to === '/admin' }" (click)="menuOpen.set(false)"><app-icon [name]="l.i" [size]="19" /><span>{{ l.t }}</span></a> }</nav>
      <div class="side-footer"><div class="account"><span class="account-icon"><app-icon name="user" [size]="18" /></span><span class="account-info"><b>{{ auth.admin()?.name }}</b><small>{{ auth.admin()?.role === 'admin' ? 'مدير' : 'موظف' }}</small></span></div>
        <div class="side-actions"><button class="theme-toggle" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.mode() === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'"><app-icon [name]="theme.mode() === 'light' ? 'moon' : 'sun'" [size]="18" /></button><button class="btn ghost sm logout" type="button" (click)="auth.logout()"><app-icon name="logout" [size]="16" /> خروج</button></div>
      </div>
    </aside>
    <section><router-outlet /></section></div>`,
  styles: [`.wrap{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100dvh;width:100%;overflow-x:clip}
  aside{position:sticky;top:0;z-index:40;height:100dvh;display:flex;flex-direction:column;overflow-y:auto;padding:22px 14px 16px;border-inline-end:1px solid var(--line);background:var(--header-bg,#0a0f24)}
  .side-head{display:flex;align-items:center;gap:11px;padding:2px 5px 20px;border-bottom:1px solid var(--line)}.brand-mark,.account-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:13px;background:rgba(124,58,237,.1);color:var(--purple-600)}.brand,.account-info{display:grid;min-width:0;line-height:1.4}.brand b{font-size:1rem}.brand small,.account-info small{color:var(--muted);font-size:.74rem}
  .nav-label{padding:20px 13px 9px;color:var(--muted);font-size:.72rem;font-weight:700}nav{display:flex;flex-direction:column;gap:4px}nav a{display:flex;align-items:center;gap:12px;min-height:43px;padding:9px 13px;border-radius:11px;color:var(--muted);font-size:.9rem;font-weight:700;transition:background .2s,color .2s}nav a.act{background:rgba(124,58,237,.13);color:var(--purple-600)}nav a:hover{background:var(--surface-1);color:var(--text)}
  .side-footer{margin-top:auto;padding:18px 4px 0;border-top:1px solid var(--line)}.account{display:flex;align-items:center;gap:10px;margin-bottom:14px}.account-icon{width:38px;height:38px}.account-info b{font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.side-actions{display:flex;gap:8px}.theme-toggle{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:var(--surface-1);color:var(--text);cursor:pointer}.logout{flex:1}.mobile-header,.close-menu,.backdrop{display:none}section{padding:28px;min-width:0;width:100%}
  @media(max-width:899px){.wrap{display:block}.mobile-header{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:12px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));border-bottom:1px solid var(--line);background:var(--header-bg,#0a0f24)}.mobile-header div{display:grid;line-height:1.3}.mobile-header b{font-size:.95rem}.mobile-header small{color:var(--muted);font-size:.7rem}.menu-toggle{width:42px;height:42px;display:grid;align-content:center;justify-items:center;gap:4px;border:1px solid var(--line);border-radius:12px;background:var(--surface-1);cursor:pointer}.menu-toggle span{width:19px;height:2px;border-radius:2px;background:var(--text)}
    aside{position:fixed;inset-block:0;inset-inline-start:0;z-index:90;width:min(290px,85vw);height:100dvh;transform:translateX(105%);visibility:hidden;transition:transform .22s ease,visibility .22s;box-shadow:-12px 0 40px rgba(0,0,0,.18)}aside.open{transform:translateX(0);visibility:visible}.close-menu{display:grid;place-items:center;margin-inline-start:auto;border:0;background:none;color:var(--muted);cursor:pointer;padding:8px}.backdrop{display:block;position:fixed;inset:0;z-index:80;border:0;background:rgba(9,16,32,.48)}section{padding:18px 12px calc(24px + env(safe-area-inset-bottom))}}
  @media(prefers-reduced-motion:reduce){aside{transition:none}}`],
})
export class AdminLayoutComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  menuOpen = signal(false);
  @HostListener('document:keydown.escape') closeMenu() { this.menuOpen.set(false); }
  links = (): { to: string; t: string; i: IconName }[] => [{ to: '/admin', t: 'نظرة عامة', i: 'chart' }, { to: '/admin/bookings', t: 'الحجوزات', i: 'clipboard' }, { to: '/admin/transfers', t: 'التحويلات', i: 'wallet' }, { to: '/admin/customers', t: 'العملاء', i: 'users' }, { to: '/admin/profile', t: 'ملف الإدارة', i: 'user' },
    ...(this.auth.isAdmin() ? [{ to: '/admin/packages', t: 'الباقات', i: 'package' as const }, { to: '/admin/networks', t: 'الشبكات', i: 'radio' as const }, { to: '/admin/whatsapp', t: 'واتساب', i: 'message' as const }, { to: '/admin/settings', t: 'الإعدادات', i: 'settings' as const }] : [])];
}
