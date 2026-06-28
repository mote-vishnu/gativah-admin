import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="wrap">
      <div class="card">
        <span class="ic"><lucide-icon name="ban" [size]="26" /></span>
        <h1>Access denied</h1>
        <p class="muted">
          You don't have permission to view this, or your session is no longer valid.
          If you believe this is a mistake, contact a SUPER_ADMIN.
        </p>
        <div class="actions">
          <a class="btn" routerLink="/dashboard">Back to dashboard</a>
          <button class="btn primary" (click)="auth.logout()">Sign in again</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .wrap { display: grid; place-items: center; padding: 60px 20px; }
    .card { max-width: 460px; text-align: center; }
    .ic { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; margin: 0 auto 16px; background: rgba(251,113,133,0.13); color: var(--rose); }
    h1 { font-family: var(--sans); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; margin: 0 0 8px; }
    p { font-size: 13px; line-height: 1.6; margin: 0 0 20px; }
    .actions { display: flex; gap: 10px; justify-content: center; }
    .btn { display: inline-flex; align-items: center; }
  `,
})
export class ForbiddenComponent {
  readonly auth = inject(AuthService);
}
