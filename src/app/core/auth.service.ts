import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_BASE_URL } from './environment';
import { AdminMe, AuthResponse } from './models';

const TOKEN_KEY = 'gativah-admin.token';
const ME_KEY = 'gativah-admin.me';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly me = signal<AdminMe | null>(this.readMe());
  readonly isAuthenticated = computed(() => !!this.token());

  private readMe(): AdminMe | null {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as AdminMe) : null;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/admin/auth/login`, { email, password })
      .pipe(tap((res) => this.store(res)));
  }

  verifyMfa(email: string, password: string, code: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/admin/auth/verify-mfa`, { email, password, code })
      .pipe(tap((res) => this.store(res)));
  }

  private store(res: AuthResponse): void {
    if (res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(ME_KEY, JSON.stringify(res.user));
      this.token.set(res.token);
      this.me.set(res.user);
    }
  }

  /** True when the signed-in admin holds the given `FEATURE:ACTION` permission. */
  can(code: string): boolean {
    return this.me()?.permissions?.includes(code) ?? false;
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ME_KEY);
    this.token.set(null);
    this.me.set(null);
    void this.router.navigate(['/login']);
  }
}
