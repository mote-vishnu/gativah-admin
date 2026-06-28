import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InputComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { MfaApi } from '../../core/admin.api';
import { MfaStart } from '../../core/models';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, InputComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="shield-check" title="Security" subtitle="Your account & two-factor authentication" tint="green" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="card mfa">
      <div class="card-h">
        <h3>Two-factor authentication (TOTP)</h3>
        @if (enrolled()) { <span class="pill active">Enabled</span> } @else { <span class="pill pending">Not set up</span> }
      </div>

      @if (enrolled()) {
        <p class="muted">MFA is active on your account. You'll be asked for a 6-digit code at each sign-in.</p>
      } @else if (!started()) {
        <p class="muted">Protect your operator account with an authenticator app (Google Authenticator, 1Password, Authy…).</p>
        <button class="btn primary" (click)="start()" [disabled]="busy()">Set up MFA</button>
      } @else if (start_(); as s) {
        <ol class="steps">
          <li>
            Add this secret to your authenticator app (manual entry):
            <div class="secret mono">{{ s.secret }}</div>
            <div class="uri mono">{{ s.otpauthUri }}</div>
          </li>
          <li>
            Enter the current 6-digit code to confirm:
            <div class="confirm">
              <ui-input class="code" inputmode="numeric" [maxlength]="6" placeholder="000000" [(ngModel)]="code" (enter)="enable()" />
              <button class="btn primary" (click)="enable()" [disabled]="busy()">Verify &amp; enable</button>
            </div>
          </li>
        </ol>
      }
    </div>
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .mfa { max-width: 640px; }
    p { font-size: 13px; }
    .steps { padding-left: 18px; margin: 6px 0 0; font-size: 13px; }
    .steps li { margin-bottom: 16px; }
    .secret { font-size: 18px; letter-spacing: 0.12em; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 8px 0; word-break: break-all; }
    .uri { font-size: 11px; color: var(--muted-2); word-break: break-all; }
    .confirm { display: flex; gap: 10px; margin-top: 8px; align-items: flex-start; }
    .code { width: 160px; }
  `,
})
export class SecurityComponent implements OnInit {
  private readonly api = inject(MfaApi);

  readonly enrolled = signal(false);
  readonly started = signal(false);
  readonly start_ = signal<MfaStart | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  code = '';

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => this.enrolled.set(s.enrolled),
      error: () => this.error.set('Could not load MFA status.'),
    });
  }

  start(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.start().subscribe({
      next: (s) => { this.busy.set(false); this.start_.set(s); this.started.set(true); },
      error: () => { this.busy.set(false); this.error.set('Could not start MFA setup.'); },
    });
  }

  enable(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.enable(this.code.trim()).subscribe({
      next: (s) => { this.busy.set(false); this.enrolled.set(s.enrolled); this.started.set(false); },
      error: () => { this.busy.set(false); this.error.set('Invalid code — check the time on your device and try again.'); },
    });
  }
}
