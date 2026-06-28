import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
const KEY = 'gativah-admin.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  private initial(): Theme {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' ? 'light' : 'dark';
  }

  apply(): void {
    document.documentElement.setAttribute('data-theme', this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(KEY, theme);
    this.apply();
  }
}
