import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from './api.service';
import { tap } from 'rxjs';

// sessionStorage (cleared when the tab closes) - the JWT is short-lived (8h) and never leaves the browser except to our API.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService); private router = inject(Router);
  token = signal<string | null>(sessionStorage.getItem('tt_token'));
  admin = signal<{ name: string; email: string; role: string } | null>(JSON.parse(sessionStorage.getItem('tt_admin') || 'null'));
  isAdmin = computed(() => this.admin()?.role === 'admin');
  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap(r => this.setAdminSession(r.token, r.admin)));
  }
  setAdminSession(token: string, admin: { name: string; email: string; role: string }) {
    sessionStorage.setItem('tt_token', token); sessionStorage.setItem('tt_admin', JSON.stringify(admin)); this.token.set(token); this.admin.set(admin);
  }
  clearAdminSession() { sessionStorage.removeItem('tt_token'); sessionStorage.removeItem('tt_admin'); this.token.set(null); this.admin.set(null); }
  logout() { this.clearAdminSession(); this.router.navigate(['/login']); }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService); const t = auth.token();
  const customerToken = sessionStorage.getItem('tt_customer_token');
  const adminRequest = req.url.startsWith('/api/admin') && !req.url.endsWith('/auth/login');
  const selected = adminRequest ? t : (req.url.startsWith('/api/account/') || (req.url === '/api/bookings' && req.method === 'POST')) ? customerToken : null;
  const authed = selected ? req.clone({ setHeaders: { Authorization: `Bearer ${selected}` } }) : req;
  return next(authed).pipe(tap({ error: e => { if (e.status === 401 && t && req.url.startsWith('/api/admin') && !req.url.endsWith('/auth/login')) auth.logout(); } }));
};
export const authGuard: CanActivateFn = () => { const a = inject(AuthService); return a.token() ? true : inject(Router).createUrlTree(['/admin/login']); };
export const adminOnlyGuard: CanActivateFn = () => inject(AuthService).isAdmin() ? true : inject(Router).createUrlTree(['/admin']);
