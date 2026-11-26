import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Subject, catchError, exhaustMap, filter, take, timer, timeout } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WarmupService {
  private http = inject(HttpClient);
  readonly ready = signal(false);
  readonly visible = signal(false);
  readonly active = signal(0);
  readonly recovered = new Subject<void>();
  readonly messages = ['بنجهزلك العروض...', 'بنرتب الباقات عشانك...', 'ثواني ونكون جاهزين...'];
  readonly networks = [
    { name: 'فودافون', logo: '/logos/vodafone.png' },
    { name: 'اتصالات', logo: '/logos/etisalat.png' },
    { name: 'أورنج', logo: '/logos/orange.png' },
    { name: 'WE', logo: '/logos/we.png' },
  ];
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    let timedOut = false;
    const showTimer = setTimeout(() => { if (!this.ready()) this.visible.set(true); }, 350);
    const animationTimer = setInterval(() => this.active.update(i => i + 1), 2400);
    const release = () => { clearTimeout(showTimer); clearInterval(animationTimer); this.visible.set(false); this.ready.set(true); };
    const deadline = setTimeout(() => { timedOut = true; release(); }, 90_000);
    // Keep trying in the background after the deadline so pages can refresh when the API returns.
    timer(0, 6000).pipe(
      filter(i => !this.ready() || i % 5 === 0),
      exhaustMap(() => this.http.get<{ ok?: boolean }>('/api/health', { headers: { 'Cache-Control': 'no-cache' } }).pipe(timeout(5500), catchError(() => EMPTY))),
      filter(response => response?.ok === true),
      take(1),
    ).subscribe(() => { clearTimeout(deadline); release(); if (timedOut) this.recovered.next(); });
  }
}
