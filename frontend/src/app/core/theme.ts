import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal<ThemeMode>(this.readSavedTheme());

  constructor() { this.apply(this.mode()); }

  toggle() {
    const next = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    localStorage.setItem('tt_theme', next);
    this.apply(next);
  }

  private readSavedTheme(): ThemeMode {
    return localStorage.getItem('tt_theme') === 'dark' ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode) {
    document.documentElement.dataset['theme'] = mode;
    document.documentElement.style.colorScheme = mode;
  }
}
