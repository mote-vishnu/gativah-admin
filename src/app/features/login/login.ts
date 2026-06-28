import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <div class="card login">
        <div class="top">
          <div class="logo"><span class="mark">G</span><span class="name">Gativah<small>Platform Admin</small></span></div>
          <button class="btn" (click)="theme.toggle()">{{ theme.theme() === 'dark' ? '☾' : '☀' }}</button>
        </div>

        @if (step() === 'creds') {
          <h2>Operator sign-in</h2>
          <p class="muted">Restricted to authorized staff. Every action is audited.</p>
          <label class="field">Work email</label>
          <input class="input" type="email" [(ngModel)]="email" (keyup.enter)="submit()" />
          <label class="field">Password</label>
          <input class="input" type="password" [(ngModel)]="password" (keyup.enter)="submit()" />
          <button class="btn primary full" (click)="submit()" [disabled]="loading()">Continue</button>
        } @else {
          <h2>Two-factor</h2>
          <p class="muted">Enter the 6-digit code from your authenticator app.</p>
          <input class="input code" [(ngModel)]="code" maxlength="6" (keyup.enter)="verify()" />
          <button class="btn primary full" (click)="verify()" [disabled]="loading()">Verify &amp; enter</button>
          <button class="btn full ghost" (click)="back()">Back</button>
        }

        @if (error()) { <div class="err">{{ error() }}</div> }
        <div class="foot">SUPER_ADMIN · MODERATOR · FINANCE · SUPPORT · MFA required</div>
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .login { width: 400px; max-width: 100%; }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 11px; }
    .mark { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; font-family: var(--disp); font-weight: 800; color: #fff; font-size: 19px; }
    .name { font-family: var(--disp); font-weight: 700; font-size: 18px; line-height: 1; }
    .name small { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted-2); letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px; }
    h2 { font-family: var(--disp); font-size: 24px; margin: 0 0 6px; }
    p { margin: 0 0 18px; font-size: 13px; }
    .full { width: 100%; margin-top: 22px; }
    .ghost { margin-top: 10px; background: transparent; }
    .code { font-family: var(--mono); font-size: 22px; text-align: center; letter-spacing: 0.3em; }
    .err { margin-top: 16px; color: var(--rose); font-size: 13px; background: rgba(251, 113, 133, 0.1); border: 1px solid rgba(251, 113, 133, 0.3); border-radius: 10px; padding: 10px 13px; }
    .foot { margin-top: 22px; font-size: 11px; color: var(--muted-2); text-align: center; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  email = '';
  password = '';
  code = '';
  readonly step = signal<'creds' | 'mfa'>('creds');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.mfaRequired) {
          this.step.set('mfa');
        } else {
          void this.router.navigate(['/']);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid credentials.');
      },
    });
  }

  verify(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.verifyMfa(this.email.trim(), this.password, this.code.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid or expired code.');
      },
    });
  }

  back(): void {
    this.step.set('creds');
    this.code = '';
    this.error.set(null);
  }
}
