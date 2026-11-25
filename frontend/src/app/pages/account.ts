import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../core/account';
import { AuthService } from '../core/auth';
import { ToastService } from '../core/ui';
import { IconComponent } from '../shared/icon';

const formStyles = [`.auth-page{max-width:480px;margin:0 auto;padding-block:clamp(36px,7vw,76px)}.intro{text-align:center;margin-bottom:22px}.mark{width:56px;height:56px;display:grid;place-items:center;margin:0 auto 14px;border-radius:18px;background:rgba(124,58,237,.1);color:var(--purple-600)}.intro h1{font-size:1.8rem;margin-bottom:8px}.intro p{margin:0}.auth-card{padding:24px}.auth-card .field label{margin-bottom:6px}.alternate{text-align:center;margin:18px 0 0;font-size:.9rem}.alternate a{color:var(--purple-600);font-weight:800}.hint{font-size:.8rem;margin:6px 0 0}.validation{font-size:.8rem;color:var(--bad);margin:5px 0 0}@media(max-width:600px){.auth-page{padding-block:28px}.auth-card{padding:18px}}`];

@Component({
  selector: 'app-account-login', standalone: true, imports: [ReactiveFormsModule, RouterLink, IconComponent], styles: formStyles,
  template: `<div class="container auth-page"><div class="intro"><div class="mark"><app-icon name="user" [size]="25" /></div><h1>أهلاً بيك</h1><p class="muted">سجّل دخولك لحسابك على تيم النزلاوي.</p></div>
    <form class="card stack auth-card" [formGroup]="form" (ngSubmit)="submit()">
      <div class="field"><label for="login-identifier">رقم الموبايل أو البريد الإلكتروني</label><input id="login-identifier" type="text" formControlName="identifier" autocomplete="username" dir="ltr" placeholder="01XXXXXXXXX"></div>
      <div class="field"><label for="login-password">كلمة المرور</label><input id="login-password" type="password" formControlName="password" autocomplete="current-password" dir="ltr"></div>
      <button class="btn gold block" [disabled]="form.invalid || busy()">{{ busy() ? 'جاري الدخول...' : 'تسجيل الدخول' }}</button>
      <p class="muted hint">الأدمن والحسابات القديمة تسجّل الدخول بالبريد الإلكتروني.</p>
    </form><p class="alternate muted">معندكش حساب؟ <a routerLink="/register">أنشئ حساب</a></p></div>`,
})
export class AccountLoginComponent {
  private fb = inject(FormBuilder); private account = inject(AccountService); private router = inject(Router); private toast = inject(ToastService);
  busy = signal(false); form = this.fb.nonNullable.group({ identifier: ['', Validators.required], password: ['', Validators.required] });
  submit() { if (this.form.invalid || this.busy()) return; this.busy.set(true); const { identifier, password } = this.form.getRawValue(); this.account.login(identifier, password).subscribe({ next: r => { this.busy.set(false); this.router.navigate([r.user.role === 'customer' ? '/account' : '/admin']); }, error: e => { this.busy.set(false); this.toast.err(e); } }); }
}

@Component({
  selector: 'app-account-register', standalone: true, imports: [ReactiveFormsModule, RouterLink, IconComponent], styles: formStyles,
  template: `<div class="container auth-page"><div class="intro"><div class="mark"><app-icon name="user" [size]="25" /></div><h1>أنشئ حسابك</h1><p class="muted">سجّل بياناتك للبدء.</p></div>
    <form class="card stack auth-card" [formGroup]="form" (ngSubmit)="submit()">
      <div class="field"><label for="register-name">الاسم</label><input id="register-name" formControlName="name" autocomplete="name"></div>
      <div class="field"><label for="register-phone">رقم الموبايل</label><input id="register-phone" type="tel" formControlName="phone" autocomplete="tel" inputmode="tel" dir="ltr" placeholder="01XXXXXXXXX"></div>
      <div class="field"><label for="register-password">كلمة المرور</label><input id="register-password" type="password" formControlName="password" autocomplete="new-password" dir="ltr"><p class="muted hint">10 أحرف على الأقل.</p></div>
      <div class="field"><label for="register-confirm">تأكيد كلمة المرور</label><input id="register-confirm" type="password" formControlName="confirm" autocomplete="new-password" dir="ltr">@if (form.controls.confirm.touched && mismatch()) { <p class="validation">كلمتا المرور غير متطابقتين.</p> }</div>
      <button class="btn gold block" [disabled]="form.invalid || mismatch() || busy()">{{ busy() ? 'جاري إنشاء الحساب...' : 'إنشاء حساب' }}</button>
    </form><p class="alternate muted">عندك حساب؟ <a routerLink="/login">سجّل الدخول</a></p></div>`,
})
export class AccountRegisterComponent {
  private fb = inject(FormBuilder); private account = inject(AccountService); private router = inject(Router); private toast = inject(ToastService);
  busy = signal(false); form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]], phone: ['', Validators.required], password: ['', [Validators.required, Validators.minLength(10)]], confirm: ['', Validators.required] });
  mismatch() { return this.form.controls.password.value !== this.form.controls.confirm.value; }
  submit() { if (this.form.invalid || this.mismatch() || this.busy()) return; this.busy.set(true); const { name, phone, password } = this.form.getRawValue(); this.account.register(name, phone, password).subscribe({ next: () => { this.busy.set(false); this.router.navigate(['/account']); }, error: e => { this.busy.set(false); this.toast.err(e); } }); }
}

@Component({
  selector: 'app-account-page', standalone: true, imports: [RouterLink, IconComponent], styles: formStyles,
  template: `<div class="container auth-page"><div class="intro"><div class="mark"><app-icon name="user" [size]="25" /></div><h1>حسابي</h1></div>
    @if (account.user(); as user) { <div class="card stack auth-card"><h2>أهلاً {{ user.name }}</h2><p class="muted" dir="ltr" style="text-align:start;overflow-wrap:anywhere">{{ user.phone || user.email }}</p><a class="btn gold block" routerLink="/orders">طلباتي</a><p class="muted hint">طلباتك الجديدة المرتبطة برقم حسابك تظهر هنا، وتقدر تضيف طلب سابق برقم الطلب.</p><button class="btn ghost block" (click)="logout()">تسجيل الخروج</button></div> }
    @else if (admin.admin()) { <div class="card stack auth-card"><p>أنت مسجّل بحساب الإدارة.</p><a class="btn gold block" routerLink="/admin">لوحة الإدارة</a><button class="btn ghost block" (click)="admin.logout()">تسجيل الخروج</button></div> }
    @else if (account.restoring()) { <div class="card center">جاري تحميل حسابك...</div> }
    @else { <div class="card stack auth-card center"><p>سجّل الدخول للوصول لحسابك.</p><a class="btn gold block" routerLink="/login">تسجيل الدخول</a><a routerLink="/register">إنشاء حساب</a></div> }
  </div>`,
})
export class AccountPageComponent { account = inject(AccountService); admin = inject(AuthService); private router = inject(Router); logout() { this.account.logout(); this.router.navigate(['/login']); } }
