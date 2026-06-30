import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { DrawerComponent } from '../../shared/drawer';
import { PageHeaderComponent } from '../../shared/page-header';
import { TableColumn, TableComponent } from '../../shared/table';

import { RolesApi, StaffApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Page, RoleResponse, SessionRow, StaffRow } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, InputComponent, SelectComponent, MultiSelectComponent, TableComponent, PageHeaderComponent, DrawerComponent],
  template: `
    <ui-page-header icon="user-plus" title="Staff" subtitle="Admin accounts & role assignment"
                    tint="orange" [count]="page()?.totalElements ?? null">
      @if (canAdd()) {
        <button page-actions class="btn primary" (click)="toggleInvite()"><lucide-icon name="user-plus" [size]="15" /> Invite admin</button>
      }
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (page()) {
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="users" [size]="16" /></span> Admins</div><div class="val c-orange">{{ adminCount() }}</div><div class="delta flat">{{ superCount() }} super-admin</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="shield-check" [size]="16" /></span> MFA enrolled</div><div class="val c-green">{{ mfaCount() }}<small> / {{ adminCount() }}</small></div><div class="delta flat">{{ mfaPct() }}% coverage</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="check" [size]="16" /></span> Active</div><div class="val c-cyan">{{ activeCount() }}</div><div class="delta flat">{{ disabledCount() }} disabled</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="shield-check" [size]="16" /></span> Roles</div><div class="val c-violet">{{ roles().length }}</div><div class="delta flat">defined</div></div>
      </div>
    }

    @if (showInvite()) {
      <div class="card invite">
        <div class="grid">
          <ui-input label="Email" type="email" [(ngModel)]="inv.email" />
          <ui-input label="Name" [(ngModel)]="inv.name" />
          <ui-input label="Temp password" type="password" hint="Minimum 10 characters" [(ngModel)]="inv.password" />
          <ui-multiselect label="Roles" placeholder="Assign roles…" [options]="roleOptions()" [(ngModel)]="inviteRoleIds" />
        </div>
        <div class="actions">
          <button class="btn" (click)="toggleInvite()">Cancel</button>
          <button class="btn primary" (click)="submitInvite()" [disabled]="busy() || inviteRoleIds().length === 0">Create</button>
        </div>
      </div>
    }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No staff accounts.">
      @for (s of page()?.content ?? []; track s.id) {
            <tr>
              <td><div class="u"><span class="av">{{ initials(s.name) }}</span><div class="nm"><b>{{ s.name }}</b><span>{{ s.email }}</span></div></div></td>
              <td>
                @if (editingId() === s.id) {
                  <div class="roles-edit">
                    <ui-multiselect size="sm" placeholder="Assign roles…" [options]="roleOptions()" [(ngModel)]="editRoleIds" />
                    <div class="roles-actions">
                      <button class="btn tiny" (click)="cancelRoles()">Cancel</button>
                      <button class="btn tiny primary" (click)="saveRoles(s)" [disabled]="busy()">Save</button>
                    </div>
                  </div>
                } @else {
                  <div class="chips">
                    @for (r of s.roles; track r) { <span class="chip">{{ r }}</span> }
                    @if (s.roles.length === 0) { <span class="muted">none</span> }
                    @if (canEdit()) {
                      <button class="link" (click)="openRoles(s)" title="Edit roles"><lucide-icon name="pencil" [size]="12" /></button>
                    }
                  </div>
                }
              </td>
              <td>
                @if (canEdit()) {
                  <ui-select size="sm" [options]="statusOptions" [ngModel]="s.status" (ngModelChange)="changeStatus(s, $event)" />
                } @else { {{ s.status }} }
              </td>
              <td>
                @if (s.mfaEnrolled) {
                  <span class="mfa-on">✓ enrolled</span>
                  @if (canEdit()) { <button class="link reset" (click)="resetMfa(s)" title="Reset MFA">reset</button> }
                } @else { <span class="muted">—</span> }
              </td>
              <td class="muted">
                {{ s.lastLoginAt ? (s.lastLoginAt | date: 'MMM d, HH:mm') : 'never' }}
                @if (canEdit()) { <button class="link sess" (click)="openSessions(s)">sessions</button> }
              </td>
            </tr>
      }
    </ui-table>

    <ui-drawer [open]="!!sessionsFor()" [title]="'Sessions · ' + (sessionsFor()?.name || '')" [width]="460" (closed)="closeSessions()">
      @if (sessionsLoading()) {
        <div class="empty">Loading…</div>
      } @else if (sessions().length) {
        <div class="slist">
          @for (sess of sessions(); track sess.id) {
            <div class="sitem" [class.rev]="sess.revoked">
              <div class="si-main">
                <b>{{ device(sess.userAgent) }}</b>
                <span>{{ sess.ip || 'unknown IP' }} · signed in {{ sess.createdAt | date: 'MMM d, y, HH:mm' }}</span>
              </div>
              @if (sess.revoked) {
                <span class="pill dismissed">revoked</span>
              } @else {
                <button class="btn tiny danger" (click)="revoke(sessionsFor()!, sess)" [disabled]="busy()">Revoke</button>
              }
            </div>
          }
        </div>
        <div class="note" style="margin-top:14px">Revoking a session rejects its token on the next request.</div>
      } @else {
        <div class="empty">No sessions recorded.</div>
      }
    </ui-drawer>
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; }
    .invite { margin-bottom: 18px; }
    .invite .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
    .u { display: flex; align-items: center; gap: 10px; }
    .av { width: 30px; height: 30px; border-radius: 9px; background: var(--av); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .nm b { font-size: 13px; } .nm span { display: block; font-size: 11px; color: var(--muted-2); }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .chip { font-family: var(--mono); font-size: 10px; padding: 3px 8px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); }
    .link { background: none; border: none; color: var(--brand); cursor: pointer; display: inline-flex; padding: 2px; }
    .roles-edit { display: flex; flex-direction: column; gap: 10px; min-width: 260px; }
    .roles-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .mfa-on { color: var(--green); font-size: 12px; font-weight: 600; }
    .reset { background: none; border: none; color: var(--muted-2); cursor: pointer; font-size: 10.5px; margin-left: 8px; text-decoration: underline; }
    .reset:hover { color: var(--rose); }
    .kpi .val small { font-size: 14px; color: var(--muted-2); font-weight: 600; }
    .sess { background: none; border: none; color: var(--muted-2); cursor: pointer; font-size: 10.5px; margin-left: 8px; text-decoration: underline; }
    .sess:hover { color: var(--brand); }
    .slist { display: flex; flex-direction: column; gap: 10px; }
    .sitem { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); }
    .sitem.rev { opacity: 0.6; }
    .si-main { flex: 1; min-width: 0; } .si-main b { display: block; font-size: 13px; } .si-main span { display: block; font-size: 11.5px; color: var(--muted-2); margin-top: 2px; }
    .btn.tiny.danger { color: var(--rose); } .btn.tiny.danger:hover { border-color: var(--rose); }
  `,
})
export class StaffComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;

  readonly page = signal<Page<StaffRow> | null>(null);
  readonly roles = signal<RoleResponse[]>([]);
  readonly loading = signal(true);
  readonly showInvite = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { label: 'Member' }, { label: 'Roles' }, { label: 'Status' }, { label: 'MFA' }, { label: 'Last login' },
  ];

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map((r) => ({ value: String(r.id), label: r.name })),
  );

  readonly canAdd = computed(() => this.auth.can('STAFF:ADD'));
  readonly canEdit = computed(() => this.auth.can('STAFF:EDIT'));

  private readonly rows = computed(() => this.page()?.content ?? []);
  readonly adminCount = computed(() => this.rows().length);
  readonly mfaCount = computed(() => this.rows().filter((s) => s.mfaEnrolled).length);
  readonly mfaPct = computed(() => { const n = this.adminCount(); return n ? Math.round((this.mfaCount() / n) * 100) : 0; });
  readonly activeCount = computed(() => this.rows().filter((s) => s.status === 'ACTIVE').length);
  readonly disabledCount = computed(() => this.adminCount() - this.activeCount());
  readonly superCount = computed(() => this.rows().filter((s) => s.roles.includes('SUPER_ADMIN')).length);

  // Selected role ids as strings (ui-multiselect value type), mapped to numbers on submit.
  readonly inviteRoleIds = signal<string[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly editRoleIds = signal<string[]>([]);

  readonly sessionsFor = signal<StaffRow | null>(null);
  readonly sessions = signal<SessionRow[]>([]);
  readonly sessionsLoading = signal(false);

  inv: { email: string; name: string; password: string } = { email: '', name: '', password: '' };

  ngOnInit(): void {
    this.load();
    this.rolesApi.list().subscribe({ next: (r) => this.roles.set(r.roles), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(0, 50).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load staff (needs STAFF:VIEW).'); this.loading.set(false); },
    });
  }

  toggleInvite(): void { this.showInvite.update((v) => !v); }

  submitInvite(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.invite({ ...this.inv, roleIds: this.inviteRoleIds().map(Number) }).subscribe({
      next: () => {
        this.busy.set(false);
        this.showInvite.set(false);
        this.inv = { email: '', name: '', password: '' };
        this.inviteRoleIds.set([]);
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Invite failed (duplicate email or weak password?).'); },
    });
  }

  openRoles(s: StaffRow): void {
    const ids = this.roles().filter((r) => s.roles.includes(r.name)).map((r) => String(r.id));
    this.editRoleIds.set(ids);
    this.editingId.set(s.id);
  }

  cancelRoles(): void { this.editingId.set(null); }

  saveRoles(s: StaffRow): void {
    this.busy.set(true);
    this.api.setRoles(s.id, { roleIds: this.editRoleIds().map(Number) }).subscribe({
      next: () => { this.busy.set(false); this.editingId.set(null); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not update roles.'); },
    });
  }

  changeStatus(s: StaffRow, status: string): void {
    this.api.update(s.id, { status }).subscribe({
      next: () => { this.toast.success(`${s.name} is now ${status.toLowerCase()}.`); this.load(); },
      error: (e) => { this.toast.error(e?.error?.message || 'Could not change status (the last super-admin or your own account cannot be disabled).'); this.load(); },
    });
  }

  async resetMfa(s: StaffRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Reset MFA for ${s.name}?`,
      message: 'Their 2FA enrollment is cleared and they are signed out — they must re-enroll on next login.',
      confirmLabel: 'Reset MFA',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.api.resetMfa(s.id).subscribe({
      next: () => { this.toast.success(`MFA reset for ${s.name}.`); this.load(); },
      error: () => this.toast.error('Could not reset MFA.'),
    });
  }

  openSessions(s: StaffRow): void {
    this.sessionsFor.set(s);
    this.sessions.set([]);
    this.sessionsLoading.set(true);
    this.api.sessions(s.id).subscribe({
      next: (r) => { this.sessions.set(r.items); this.sessionsLoading.set(false); },
      error: () => { this.sessionsLoading.set(false); this.toast.error('Could not load sessions.'); },
    });
  }

  closeSessions(): void { this.sessionsFor.set(null); }

  async revoke(s: StaffRow, sess: SessionRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: 'Revoke this session?',
      message: `Signs out ${device(sess.userAgent)} (${sess.ip || 'unknown IP'}) on its next request.`,
      confirmLabel: 'Revoke session',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.revokeSession(s.id, sess.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Session revoked.'); this.openSessions(s); },
      error: () => { this.busy.set(false); this.toast.error('Could not revoke the session.'); },
    });
  }

  device(ua: string | null): string {
    return device(ua);
  }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
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
