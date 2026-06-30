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

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // On app load, keep the existing session alive by scheduling a refresh
    // before the current token expires (sliding session).
    const t = this.token();
    if (t) { this.scheduleFromToken(t); }
  }

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

  /** Swap the current (still-valid) token for a fresh one — same session (jti). */
  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/admin/auth/refresh`, {})
      .pipe(tap((res) => this.store(res)));
  }

  private store(res: AuthResponse): void {
    if (res.token && res.user) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(ME_KEY, JSON.stringify(res.user));
      this.token.set(res.token);
      this.me.set(res.user);
      if (res.expiresInMs) { this.scheduleRefresh(res.expiresInMs); }
    }
  }

  /** Refresh ~2 min before expiry; on failure (revoked/disabled), sign out. */
  private scheduleRefresh(expiresInMs: number): void {
    this.clearTimer();
    const delay = Math.max(expiresInMs - 120_000, 5_000);
    this.refreshTimer = setTimeout(() => {
      this.refresh().subscribe({ error: () => this.logout() });
    }, delay);
  }

  private scheduleFromToken(token: string): void {
    const exp = tokenExpMs(token);
    if (exp == null) { return; }
    const remaining = exp - Date.now();
    if (remaining > 0) { this.scheduleRefresh(remaining); }
    // If already expired, the next API call 401s and the interceptor refreshes-or-logs-out.
  }

  private clearTimer(): void {
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
  }

  /** True when the signed-in admin holds the given `FEATURE:ACTION` permission. */
  can(code: string): boolean {
    return this.me()?.permissions?.includes(code) ?? false;
  }

  logout(): void {
    this.clearTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ME_KEY);
    this.token.set(null);
    this.me.set(null);
    void this.router.navigate(['/login']);
  }
}

/** Read the `exp` (ms) from a JWT payload without verifying it. */
function tokenExpMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) { return null; }
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
