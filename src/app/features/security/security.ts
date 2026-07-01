import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InputComponent } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { TableColumn, TableComponent } from '../../shared/table';
import { MfaApi, SecurityApi, StaffApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActiveSessionRow, MfaStart, SecurityOverview } from '../../core/models';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, DatePipe, InputComponent, IconComponent, TableComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="shield-check" title="Security" subtitle="Account protection & operator sessions" tint="green" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (canViewOrg() && overview(); as o) {
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi">
          <div class="lab"><span class="ic tint-green"><lucide-icon name="shield-check" [size]="16" /></span> MFA coverage</div>
          <div class="val" [class.c-green]="coveragePct(o) >= 80" [class.bad]="coveragePct(o) < 80">{{ coveragePct(o) }}%</div>
          <div class="delta flat">{{ o.mfaEnrolled }} / {{ o.mfaTotal }} enrolled</div>
        </div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="users" [size]="16" /></span> Active admins</div><div class="val c-cyan">{{ o.activeAdmins }}</div><div class="delta flat">of {{ o.mfaTotal }} total</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="webhook" [size]="16" /></span> Active sessions</div><div class="val c-violet">{{ o.activeSessions }}</div><div class="delta flat">live tokens</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="clock" [size]="16" /></span> Sign-ins · 7d</div><div class="val c-orange">{{ o.signIns7d }}</div><div class="delta flat">rolling week</div></div>
      </div>

      @if (o.unenrolled.length) {
        <div class="card warn">
          <div class="warn-h"><span class="ic tint-amber"><lucide-icon name="triangle-alert" [size]="16" /></span>
            <b>{{ o.unenrolled.length }} active {{ o.unenrolled.length === 1 ? 'admin has' : 'admins have' }} not enrolled MFA</b></div>
          <div class="chips">
            @for (u of o.unenrolled; track u.id) { <span class="uchip">{{ u.name }}</span> }
          </div>
          <p class="muted">Ask them to set up two-factor authentication below. Coverage should be 100% for privileged operators.</p>
        </div>
      }
    }

    <div class="card mfa">
      <div class="card-h">
        <h3>Your two-factor authentication (TOTP)</h3>
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

    @if (canViewOrg()) {
      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Active operator sessions</h3><span class="hint">live tokens across all staff</span></div>
        <ui-table [columns]="sessionCols()" [flush]="true" [loading]="sessionsLoading()"
                  [empty]="sessions().length === 0" emptyText="No active sessions.">
          @for (s of sessions(); track s.sessionId) {
            <tr>
              <td><b>{{ s.adminName || ('#' + s.adminUserId) }}</b><span class="em">{{ s.email }}</span></td>
              <td class="mono muted">{{ s.ip || '—' }}</td>
              <td>{{ device(s.userAgent) }}</td>
              <td class="muted">{{ s.createdAt | date: 'MMM d, HH:mm' }}</td>
              @if (canRevoke()) {
                <td class="rowact"><button class="link danger" (click)="revoke(s)" [disabled]="busy()">Revoke</button></td>
              }
            </tr>
          }
        </ui-table>
      </div>
    }
  `,
  styles: `
    .mfa { max-width: 640px; }
    p { font-size: 13px; }
    .steps { padding-left: 18px; margin: 6px 0 0; font-size: 13px; }
    .steps li { margin-bottom: 16px; }
    .secret { font-size: 18px; letter-spacing: 0.12em; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 8px 0; word-break: break-all; }
    .uri { font-size: 11px; color: var(--muted-2); word-break: break-all; }
    .confirm { display: flex; gap: 10px; margin-top: 8px; align-items: flex-start; }
    .code { width: 160px; }
    .kpi .val.bad { color: var(--rose); } .kpi .val.c-green { color: var(--green); } .kpi .val.c-cyan { color: var(--cyan); } .kpi .val.c-violet { color: var(--violet); } .kpi .val.c-orange { color: var(--brand); }
    .warn { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.05); margin-bottom: 18px; }
    .warn-h { display: flex; align-items: center; gap: 10px; font-size: 14px; }
    .warn-h .ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; }
    .warn .chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 4px; }
    .uchip { font-size: 12px; font-weight: 600; color: var(--amber); background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); border-radius: 999px; padding: 4px 11px; }
    .em { display: block; font-size: 11px; color: var(--muted-2); }
    .rowact { text-align: right; }
    .link { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
    .link.danger { color: var(--rose); } .link.danger:hover { text-decoration: underline; }
  `,
})
export class SecurityComponent implements OnInit {
  private readonly api = inject(MfaApi);
  private readonly securityApi = inject(SecurityApi);
  private readonly staffApi = inject(StaffApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly enrolled = signal(false);
  readonly started = signal(false);
  readonly start_ = signal<MfaStart | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  code = '';

  readonly overview = signal<SecurityOverview | null>(null);
  readonly sessions = signal<ActiveSessionRow[]>([]);
  readonly sessionsLoading = signal(false);

  readonly canViewOrg = computed(() => this.auth.can('STAFF:VIEW'));
  readonly canRevoke = computed(() => this.auth.can('STAFF:EDIT'));
  readonly sessionCols = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [{ label: 'Operator' }, { label: 'IP' }, { label: 'Device' }, { label: 'Signed in' }];
    return this.canRevoke() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.api.status().subscribe({
      next: (s) => this.enrolled.set(s.enrolled),
      error: () => this.error.set('Could not load MFA status.'),
    });
    if (this.canViewOrg()) {
      this.loadOrg();
    }
  }

  private loadOrg(): void {
    this.securityApi.overview().subscribe({ next: (o) => this.overview.set(o), error: () => {} });
    this.sessionsLoading.set(true);
    this.securityApi.sessions().subscribe({
      next: (r) => { this.sessions.set(r.sessions); this.sessionsLoading.set(false); },
      error: () => this.sessionsLoading.set(false),
    });
  }

  coveragePct(o: SecurityOverview): number {
    return o.mfaTotal === 0 ? 100 : Math.round((o.mfaEnrolled / o.mfaTotal) * 100);
  }

  device(ua: string | null): string {
    if (!ua) { return 'Unknown device'; }
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    return os ? `${browser} · ${os}` : browser;
  }

  async revoke(s: ActiveSessionRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Revoke ${s.adminName || 'this'} session?`,
      message: 'The token is rejected on its next request — the operator is signed out.',
      confirmLabel: 'Revoke session',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.staffApi.revokeSession(s.adminUserId, s.sessionId).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Session revoked.'); this.loadOrg(); },
      error: () => { this.busy.set(false); this.toast.error('Could not revoke session.'); },
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
      next: (s) => { this.busy.set(false); this.enrolled.set(s.enrolled); this.started.set(false); if (this.canViewOrg()) { this.loadOrg(); } },
      error: () => { this.busy.set(false); this.error.set('Invalid code — check the time on your device and try again.'); },
    });
  }
}
