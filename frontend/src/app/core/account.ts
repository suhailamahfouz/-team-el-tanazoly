import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthService } from './auth';

export interface AccountUser { id: string; name: string; email?: string; phone?: string; role: 'customer' | 'admin' | 'staff'; }
interface AuthResponse { token: string; user: AccountUser; }

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient); private adminAuth = inject(AuthService);
  user = signal<AccountUser | null>(null); restoring = signal(false); private restored = false;
  restore() {
    if (this.restored) return; this.restored = true;
    const token = sessionStorage.getItem('tt_customer_token'); if (!token) return;
    this.restoring.set(true);
    this.http.get<{ user: AccountUser }>('/api/account/me').subscribe({ next: r => { if (sessionStorage.getItem('tt_customer_token') === token) this.user.set(r.user); this.restoring.set(false); }, error: () => { if (sessionStorage.getItem('tt_customer_token') === token) { sessionStorage.removeItem('tt_customer_token'); this.user.set(null); } this.restoring.set(false); } });
  }
  login(identifier: string, password: string) { return this.http.post<AuthResponse>('/api/auth/login', { identifier, password }).pipe(tap(r => this.accept(r))); }
  register(name: string, phone: string, password: string) { return this.http.post<AuthResponse>('/api/auth/register', { name, phone, password }).pipe(tap(r => this.accept(r))); }
  private accept(r: AuthResponse) {
    if (r.user.role === 'customer') {
      this.adminAuth.clearAdminSession(); sessionStorage.setItem('tt_customer_token', r.token); this.user.set(r.user);
    } else {
      sessionStorage.removeItem('tt_customer_token'); this.user.set(null); this.adminAuth.setAdminSession(r.token, { name: r.user.name, email: r.user.email || '', role: r.user.role });
    }
  }
  logout() { sessionStorage.removeItem('tt_customer_token'); this.user.set(null); }
}
