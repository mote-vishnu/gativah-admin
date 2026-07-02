import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { MultiSelectComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { RolesApi, StaffApi, AuditApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuditEntryRow, RoleResponse, SessionRow, StaffRow } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

@Component({
  selector: 'app-staff-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, IconComponent, MultiSelectComponent, SelectComponent],
  template: `
    <a routerLink="/team/staff" class="back">‹ Back to staff</a>
    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (staff(); as s) {
      <div class="card phero">
        <span class="big">{{ initials(s.name) }}</span>
        <div class="pf-id">
          <div class="nameln">
            <h1>{{ s.name }}</h1>
            <span class="pill" [class]="statusClass(s.status)">{{ s.status | titlecase }}</span>
            @if (s.mfaEnrolled) { <span class="pill active">MFA on</span> } @else { <span class="pill pending">No MFA</span> }
          </div>
          <div class="handle">{{ s.email }} · #{{ s.id }}</div>
          <div class="chips">
            @for (r of s.roles; track r) { <span class="rchip">{{ r }}</span> }
            @if (s.roles.length === 0) { <span class="muted">no roles</span> }
          </div>
        </div>
      </div>

      <div class="grid">
        <div>
          <div class="card">
            <div class="card-h"><h3>Account</h3></div>
            <div class="meta">
              <div><span>Admin ID</span><b class="mono">#{{ s.id }}</b></div>
              <div><span>Email</span><b>{{ s.email }}</b></div>
              <div><span>Status</span><b>{{ s.status | titlecase }}</b></div>
              <div><span>MFA</span><b>{{ s.mfaEnrolled ? '✓ enrolled' : 'not set up' }}</b></div>
              <div><span>Member since</span><b>{{ s.createdAt ? (s.createdAt | date: 'MMM d, y') : '—' }}</b></div>
              <div><span>Last login</span><b>{{ s.lastLoginAt ? (s.lastLoginAt | date: 'MMM d, y, HH:mm') : 'never' }}</b></div>
            </div>
          </div>

          <div class="card access" style="margin-top:18px">
            <div class="card-h">
              <h3>Effective access</h3>
              <span class="hint">{{ permCount() }} permissions · {{ permGroups().length }} areas · {{ roleObjs().length }} role(s)</span>
            </div>
            @if (permGroups().length) {
              <div class="acards">
                @for (g of permGroups(); track g.feature) {
                  <div class="acard">
                    <div class="ac-h">
                      <span class="ac-ic"><lucide-icon [name]="featureIcon(g.feature)" [size]="15" /></span>
                      <span class="ac-t"><b>{{ g.feature | titlecase }}</b><small>{{ g.actions.length }} {{ g.actions.length === 1 ? 'action' : 'actions' }}</small></span>
                    </div>
                    <div class="ac-actions">
                      @for (a of g.actions; track a) { <span class="apill" [class]="actionClass(a)"><i class="dot"></i>{{ a | titlecase }}</span> }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="access-empty"><lucide-icon name="shield-check" [size]="18" /> No permissions yet — assign a role to grant access.</div>
            }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Recent activity</h3><span class="hint">actions by this operator</span></div>
            @if (activityLoading()) { <div class="empty">Loading…</div> }
            @else if (activity().length) {
              <div class="timeline">
                @for (a of activity(); track a.id) {
                  <div class="tl">
                    <div class="when">{{ a.createdAt | date: 'MMM d, y, HH:mm' }}@if (a.ip) { · {{ a.ip }} }</div>
                    <div class="what"><span class="pill" [class]="auditClass(a.action)">{{ prettyAction(a.action) }}</span> <span class="muted">{{ a.summary || (a.targetType ? a.targetType + ' #' + a.targetId : '—') }}</span></div>
                  </div>
                }
              </div>
            } @else { <div class="empty">No recorded actions.</div> }
          </div>
        </div>

        <div>
          @if (canEdit()) {
            <div class="card" style="margin-bottom:18px">
              <div class="card-h"><h3>Manage</h3></div>
              <label class="fl">Roles</label>
              <ui-multiselect placeholder="Assign roles…" [options]="roleOptions()" [(ngModel)]="editRoleIds" />
              <button class="btn primary full" (click)="saveRoles(s)" [disabled]="busy()"><lucide-icon name="check" [size]="15" /> Save roles</button>
              <label class="fl" style="margin-top:16px">Status</label>
              <ui-select [options]="statusOptions" [ngModel]="s.status" (ngModelChange)="changeStatus(s, $event)" />
              <button class="btn full" style="margin-top:16px" (click)="resetMfa(s)" [disabled]="busy() || !s.mfaEnrolled"><lucide-icon name="shield-check" [size]="15" /> Reset MFA</button>
              <div class="note" style="margin-top:14px">⚠ The last super-admin and your own account can't be disabled.</div>
            </div>
          } @else {
            <div class="card" style="margin-bottom:18px"><div class="note">Read-only access to staff (no STAFF:EDIT).</div></div>
          }

          <div class="card">
            <div class="card-h"><h3>Sessions</h3><span class="hint">{{ sessions().length }}</span></div>
            @if (sessionsLoading()) { <div class="empty">Loading…</div> }
            @else if (sessions().length) {
              @for (sess of sessions(); track sess.id) {
                <div class="sitem" [class.rev]="sess.revoked">
                  <div class="si"><b>{{ device(sess.userAgent) }}</b><span>{{ sess.ip || 'unknown IP' }} · {{ sess.createdAt | date: 'MMM d, HH:mm' }}</span></div>
                  @if (sess.revoked) { <span class="pill dismissed">revoked</span> }
                  @else if (canEdit()) { <button class="btn tiny danger" (click)="revoke(s, sess)" [disabled]="busy()">Revoke</button> }
                </div>
              }
            } @else { <div class="empty">No sessions recorded.</div> }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .phero { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 20px; }
    .big { width: 60px; height: 60px; flex: 0 0 auto; border-radius: 16px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; color: #fff; font-family: var(--sans); font-weight: 800; font-size: 20px; box-shadow: var(--shadow-sm); }
    .pf-id { min-width: 0; flex: 1; }
    .nameln { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .nameln h1 { font-family: var(--sans); font-weight: 800; font-size: 21px; margin: 0; letter-spacing: -0.02em; }
    .handle { color: var(--muted-2); font-size: 12.5px; margin-top: 5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .rchip { font-family: var(--mono); font-size: 10px; padding: 3px 9px; border-radius: 999px; background: var(--brand-soft); border: 1px solid var(--brand-line); color: var(--brand); font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .meta > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .meta > div:last-child { border-bottom: 0; } .meta > div span { color: var(--muted-2); }
    .acards { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 12px; }
    .acard { border: 1px solid var(--line); border-radius: 13px; padding: 13px 14px; background: var(--surface-2); transition: 0.15s var(--ease); }
    .acard:hover { border-color: var(--line-strong); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
    .ac-h { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .ac-ic { width: 30px; height: 30px; flex: 0 0 auto; border-radius: 9px; display: grid; place-items: center; color: var(--muted); background: var(--surface-3); }
    .ac-t { min-width: 0; } .ac-t b { display: block; font-size: 13px; letter-spacing: -0.01em; }
    .ac-t small { font-size: 10px; color: var(--muted-2); }
    .ac-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .apill { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; padding: 3px 9px 3px 8px; border-radius: 999px; color: var(--muted); background: color-mix(in srgb, currentColor 11%, transparent); border: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
    .apill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .apill.view { color: var(--cyan); } .apill.add { color: var(--green); } .apill.edit { color: var(--amber); } .apill.del { color: var(--rose); }
    .access-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 26px; color: var(--muted-2); font-size: 13px; }
    .timeline { display: flex; flex-direction: column; gap: 2px; }
    .tl { padding: 9px 0 9px 15px; border-left: 2px solid var(--line); position: relative; }
    .tl::before { content: ''; position: absolute; left: -5px; top: 13px; width: 8px; height: 8px; border-radius: 50%; background: var(--brand); }
    .tl .when { font-family: var(--mono); font-size: 10.5px; color: var(--muted-2); }
    .tl .what { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; font-size: 12.5px; }
    .fl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); font-weight: 600; margin-bottom: 7px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; } .btn.full { width: 100%; justify-content: center; margin-top: 10px; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; } .btn.tiny.danger { color: var(--rose); } .btn.tiny.danger:hover { border-color: var(--rose); }
    .sitem { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line-soft); }
    .sitem:last-child { border-bottom: 0; } .sitem.rev { opacity: 0.55; }
    .si { flex: 1; min-width: 0; } .si b { display: block; font-size: 12.5px; } .si span { display: block; font-size: 11px; color: var(--muted-2); margin-top: 2px; }
    .empty { padding: 24px; text-align: center; color: var(--muted-2); font-size: 13px; }
  `,
})
export class StaffDetailComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly auditApi = inject(AuditApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;
  readonly staff = signal<StaffRow | null>(null);
  readonly roles = signal<RoleResponse[]>([]);
  readonly sessions = signal<SessionRow[]>([]);
  readonly sessionsLoading = signal(true);
  readonly activity = signal<AuditEntryRow[]>([]);
  readonly activityLoading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly editRoleIds = signal<string[]>([]);

  readonly canEdit = computed(() => this.auth.can('STAFF:EDIT'));
  readonly roleOptions = computed<SelectOption[]>(() => this.roles().map((r) => ({ value: String(r.id), label: r.name })));
  readonly roleObjs = computed(() => {
    const names = new Set(this.staff()?.roles ?? []);
    return this.roles().filter((r) => names.has(r.name));
  });
  readonly permGroups = computed(() => {
    const set = new Set<string>();
    this.roleObjs().forEach((r) => r.permissions.forEach((p) => set.add(p)));
    const groups: Record<string, string[]> = {};
    [...set].forEach((code) => { const [f, a] = code.split(':'); (groups[f] ??= []).push(a); });
    return Object.entries(groups)
      .map(([feature, actions]) => ({ feature, actions: actions.sort() }))
      .sort((a, b) => a.feature.localeCompare(b.feature));
  });
  readonly permCount = computed(() => this.permGroups().reduce((n, g) => n + g.actions.length, 0));

  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.rolesApi.list().subscribe({ next: (r) => { this.roles.set(r.roles); this.syncEdit(); }, error: () => {} });
    this.reload();
    this.loadSessions();
    this.auditApi.list({ actorId: this.id, size: 30 }).subscribe({
      next: (p) => { this.activity.set(p.content); this.activityLoading.set(false); },
      error: () => this.activityLoading.set(false),
    });
  }

  private reload(): void {
    this.api.get(this.id).subscribe({
      next: (s) => { this.staff.set(s); this.syncEdit(); },
      error: () => this.error.set('Could not load this staff member.'),
    });
  }

  private loadSessions(): void {
    this.sessionsLoading.set(true);
    this.api.sessions(this.id).subscribe({
      next: (r) => { this.sessions.set(r.items); this.sessionsLoading.set(false); },
      error: () => this.sessionsLoading.set(false),
    });
  }

  /** Preselect the roles multiselect once both staff + roles are loaded. */
  private syncEdit(): void {
    const s = this.staff();
    if (!s || !this.roles().length) { return; }
    this.editRoleIds.set(this.roles().filter((r) => s.roles.includes(r.name)).map((r) => String(r.id)));
  }

  saveRoles(s: StaffRow): void {
    this.busy.set(true);
    this.api.setRoles(s.id, { roleIds: this.editRoleIds().map(Number) }).subscribe({
      next: (u) => { this.busy.set(false); this.staff.set(u); this.toast.success('Roles updated.'); },
      error: () => { this.busy.set(false); this.toast.error('Could not update roles.'); },
    });
  }

  changeStatus(s: StaffRow, status: string): void {
    this.api.update(s.id, { status }).subscribe({
      next: (u) => { this.staff.set(u); this.toast.success(`${s.name} is now ${status.toLowerCase()}.`); },
      error: (e) => { this.toast.error(e?.error?.message || 'Could not change status.'); this.reload(); },
    });
  }

  async resetMfa(s: StaffRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Reset MFA for ${s.name}?`,
      message: 'Their 2FA enrollment is cleared and they are signed out — they must re-enroll on next login.',
      confirmLabel: 'Reset MFA', tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.resetMfa(s.id).subscribe({
      next: (u) => { this.busy.set(false); this.staff.set(u); this.toast.success(`MFA reset for ${s.name}.`); },
      error: () => { this.busy.set(false); this.toast.error('Could not reset MFA.'); },
    });
  }

  async revoke(s: StaffRow, sess: SessionRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: 'Revoke this session?', message: `Signs out ${device(sess.userAgent)} on its next request.`,
      confirmLabel: 'Revoke session', tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.revokeSession(s.id, sess.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Session revoked.'); this.loadSessions(); },
      error: () => { this.busy.set(false); this.toast.error('Could not revoke the session.'); },
    });
  }

  device(ua: string | null): string { return device(ua); }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  statusClass(s: string): string {
    return s === 'ACTIVE' ? 'active' : 'dismissed';
  }

  featureIcon(code: string): string {
    switch (code) {
      case 'DASHBOARD': return 'layout-dashboard';
      case 'GRIEVANCES': return 'flag';
      case 'APPEALS': case 'LEGAL': return 'scale';
      case 'FINANCE': return 'dollar-sign';
      case 'BILLING': return 'credit-card';
      case 'STAFF': case 'USERS': return 'users';
      case 'ROLES': return 'shield-check';
      case 'AUDIT': return 'scroll-text';
      case 'CONTENT': return 'message-square';
      case 'CLUBS': return 'users-round';
      case 'ANALYTICS': return 'chart-line';
      default: return 'shield-check';
    }
  }

  /** Colour-code an access-level pill by action: VIEW/ADD/EDIT/DELETE. */
  actionClass(action: string): string {
    switch (action) {
      case 'ADD': return 'add';
      case 'EDIT': return 'edit';
      case 'DELETE': return 'del';
      default: return 'view';
    }
  }

  prettyAction(a: string): string {
    return a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  auditClass(a: string): string {
    if (a.includes('BAN') || a.includes('TAKEDOWN') || a.includes('DELETE')) { return 'banned'; }
    if (a.includes('SUSPEND') || a.includes('WARN')) { return 'pending'; }
    if (a.includes('REINSTATE') || a.includes('VERIFY') || a.includes('APPROVE') || a.includes('RESTORE')) { return 'active'; }
    return 'reason';
  }
}

/** Short, human label from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) { return 'Unknown device'; }
  const browser = /(Edg|Chrome|Firefox|Safari)/.exec(ua)?.[1];
  const os = /(Windows|Mac OS|Android|iPhone|iPad|Linux)/.exec(ua)?.[1];
  const label = [browser === 'Edg' ? 'Edge' : browser, os].filter(Boolean).join(' · ');
  return label || 'Browser';
}
