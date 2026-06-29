import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ChartComponent } from '../../shared/chart';
import { InputComponent, TextareaComponent } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';
import { UsersApi } from '../../core/users.api';
import { AuthService } from '../../core/auth.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { AuditEntryRow, UserDetail, UserInsights } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, InputComponent, TextareaComponent, TableComponent, ChartComponent],
  template: `
    <a routerLink="/users" class="back">‹ Back to users</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (user(); as u) {
      <div class="head">
        <div class="who">
          <span class="av">{{ initials(u) }}</span>
          <div>
            <h1 class="title">{{ '@' + u.username }} @if (u.verified) { <span class="verified" title="Verified">✓</span> }</h1>
            <p class="crumb">{{ fullName(u) }} · {{ u.email }}</p>
          </div>
        </div>
        <span class="pill" [class]="statusClass(u.accountStatus)">{{ u.accountStatus | titlecase }}</span>
      </div>

      <div class="subtabs" style="margin-bottom:18px">
        <button [class.on]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button [class.on]="tab() === 'audit'" (click)="showAudit()">Audit trail</button>
      </div>

      @if (tab() === 'overview') {
      <div class="grid">
        <div>
          <div class="card">
            <div class="card-h"><h3>Account</h3></div>
            <div class="meta">
              <div><span>User ID</span><b>#{{ u.id }}</b></div>
              <div><span>Joined</span><b>{{ u.createdAt | date: 'MMM d, y' }}</b></div>
              <div><span>Status</span><b>{{ u.accountStatus | titlecase }}</b></div>
              @if (u.suspendedUntil) { <div><span>Suspended until</span><b>{{ u.suspendedUntil | date: 'MMM d, y, HH:mm' }}</b></div> }
              @if (u.statusReason) { <div><span>Reason</span><b>{{ u.statusReason }}</b></div> }
            </div>
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Subscription</h3></div>
            @if (u.subscription; as s) {
              <div class="meta">
                <div><span>Plan</span><b>{{ s.planCode }}</b></div>
                <div><span>Platform</span><b>{{ s.platform }}</b></div>
                <div><span>State</span><b>{{ s.state | titlecase }}{{ s.trial ? ' · trial' : '' }}</b></div>
                <div><span>Auto-renew</span><b>{{ s.autoRenew ? 'On' : 'Off' }}</b></div>
                <div><span>Renews</span><b>{{ s.currentPeriodEnd ? (s.currentPeriodEnd | date: 'MMM d, y') : '—' }}</b></div>
              </div>
            } @else {
              <div class="empty">No subscription.</div>
            }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Activity</h3><span class="hint">last 90 days</span></div>
            @if ((insights()?.activity?.length ?? 0) > 0) {
              <ui-chart type="area" [series]="activitySeries()" [categories]="activityCats()" [colors]="['--cyan']" [height]="200" />
            } @else { <div class="empty">No recent activity.</div> }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Devices &amp; sessions</h3><span class="hint">{{ insights()?.devices?.length ?? 0 }}</span></div>
            <ui-table [columns]="deviceCols" [flush]="true" [empty]="(insights()?.devices?.length ?? 0) === 0" emptyText="No devices.">
              @for (d of insights()?.devices ?? []; track $index) {
                <tr>
                  <td>{{ d.platform }}</td>
                  <td class="muted">{{ d.appVersion || '—' }}</td>
                  <td class="muted">{{ d.locale || '—' }}</td>
                  <td class="muted">{{ d.lastSeenAt ? (d.lastSeenAt | date: 'MMM d, y') : '—' }}</td>
                </tr>
              }
            </ui-table>
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Sanction history</h3><span class="hint">{{ u.sanctions.length }} record(s)</span></div>
            <ui-table [columns]="sanctionCols" [flush]="true" [empty]="u.sanctions.length === 0" emptyText="No sanctions.">
              @for (s of u.sanctions; track s.id) {
                <tr>
                  <td><span class="pill" [class]="sanctionClass(s.type)">{{ s.type | titlecase }}</span></td>
                  <td class="muted">{{ s.reason || '—' }}</td>
                  <td class="muted">{{ s.suspendedUntil ? (s.suspendedUntil | date: 'MMM d, y') : '—' }}</td>
                  <td>#{{ s.adminUserId }}</td>
                  <td class="muted">{{ s.createdAt | date: 'MMM d, HH:mm' }}</td>
                </tr>
              }
            </ui-table>
          </div>
        </div>

        <div>
          @if (insights(); as ins) {
            <div class="card" style="margin-bottom:18px">
              <div class="card-h"><h3>Risk</h3><span class="pill" [class]="riskClass(ins.riskLevel)">{{ ins.riskLevel | titlecase }}</span></div>
              <div class="riskbar"><span [class]="riskClass(ins.riskLevel)" [style.width.%]="ins.riskScore"></span></div>
              <div class="meta" style="margin-top:12px">
                <div><span>Score</span><b>{{ ins.riskScore }}/100</b></div>
                <div><span>Reports against</span><b>{{ ins.reportsAgainst }}</b></div>
                <div><span>Sanctions</span><b>{{ ins.sanctionCount }}</b></div>
              </div>
            </div>
          }
          @if (canEdit()) {
            <div class="card">
              <div class="card-h"><h3>Actions</h3></div>
              <ui-textarea label="Reason" [rows]="3" placeholder="Recorded with the action…" [(ngModel)]="reason" />
              <ui-input label="Suspend duration (days)" type="number" placeholder="7" [(ngModel)]="days" />
              <div class="acts">
                <button class="btn" (click)="suspend()" [disabled]="busy()">Suspend</button>
                <button class="btn danger" (click)="ban()" [disabled]="busy()">Ban</button>
                @if (u.accountStatus !== 'ACTIVE') {
                  <button class="btn" (click)="reinstate()" [disabled]="busy()">Reinstate</button>
                }
                <button class="btn" (click)="toggleVerified(u)" [disabled]="busy()">{{ u.verified ? 'Remove verified badge' : 'Grant verified badge' }}</button>
              </div>
              <div class="note" style="margin-top:14px">⚠ Actions run via the internal hook on pacegrit-service and are written to the audit log.</div>
            </div>
          } @else {
            <div class="card"><div class="note">Read-only access to users (no USERS:EDIT).</div></div>
          }
        </div>
      </div>
      }

      @if (tab() === 'audit') {
        <div class="card">
          <div class="card-h"><h3>Audit trail</h3><span class="hint">admin actions taken against this account</span></div>
          @if (auditLoading()) {
            <div class="empty">Loading…</div>
          } @else if (audit().length) {
            <div class="timeline" style="margin-top:6px">
              @for (a of audit(); track a.id) {
                <div class="tl">
                  <div class="when">{{ a.createdAt | date: 'MMM d, y, HH:mm' }} · {{ dir.name(a.adminUserId) }}@if (a.ip) { · {{ a.ip }} }</div>
                  <div class="what" style="display:flex;align-items:center;gap:8px;margin-top:4px">
                    <span class="pill" [class]="auditClass(a.action)">{{ prettyAction(a.action) }}</span>
                    <span class="muted">{{ a.summary || '—' }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty">No admin actions recorded for this account.</div>
          }
        </div>
      }
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .who { display: flex; align-items: center; gap: 14px; }
    .av { width: 48px; height: 48px; border-radius: 13px; background: var(--av); display: grid; place-items: center; font-size: 16px; font-weight: 700; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 2px; letter-spacing: -0.02em; }
    .verified { color: var(--brand); font-size: 15px; }
    .crumb { color: var(--muted-2); font-size: 12.5px; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .meta > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .meta > div:last-child { border-bottom: 0; }
    .meta > div span { color: var(--muted-2); }
    .acts { display: flex; flex-direction: column; gap: 9px; margin-top: 14px; }
    .riskbar { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
    .riskbar span { display: block; height: 100%; border-radius: 999px; }
    .riskbar span.active { background: var(--green); }
    .riskbar span.pending { background: var(--amber); }
    .riskbar span.banned { background: var(--rose); }
  `,
})
export class UserDetailComponent implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly dir = inject(AdminDirectoryService);

  readonly tab = signal<'overview' | 'audit'>('overview');
  readonly audit = signal<AuditEntryRow[]>([]);
  readonly auditLoading = signal(false);
  private auditLoaded = false;

  readonly user = signal<UserDetail | null>(null);
  readonly insights = signal<UserInsights | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('USERS:EDIT'));

  readonly sanctionCols: TableColumn[] = [
    { label: 'Type' }, { label: 'Reason' }, { label: 'Until' }, { label: 'By' }, { label: 'When' },
  ];
  readonly deviceCols: TableColumn[] = [
    { label: 'Platform' }, { label: 'App' }, { label: 'Locale' }, { label: 'Last seen' },
  ];
  readonly activitySeries = computed(() => [{ name: 'Steps', data: (this.insights()?.activity ?? []).map((a) => a.steps) }]);
  readonly activityCats = computed(() => (this.insights()?.activity ?? []).map((a) => a.date));

  reason = '';
  days: string | number = '';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.dir.load();
    this.api.detail(id).subscribe({
      next: (u) => this.user.set(u),
      error: () => this.error.set('Could not load this user.'),
    });
    this.api.insights(id).subscribe({ next: (ins) => this.insights.set(ins), error: () => {} });
  }

  showAudit(): void {
    this.tab.set('audit');
    if (this.auditLoaded) { return; }
    this.auditLoaded = true;
    this.auditLoading.set(true);
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.audit(id, 0, 50).subscribe({
      next: (p) => { this.audit.set(p.content); this.auditLoading.set(false); },
      error: () => { this.auditLoading.set(false); },
    });
  }

  prettyAction(a: string): string {
    return a.replace(/^USER_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  auditClass(a: string): string {
    if (a.includes('BAN')) { return 'banned'; }
    if (a.includes('SUSPEND')) { return 'pending'; }
    if (a.includes('REINSTATE') || a.includes('VERIFY')) { return 'active'; }
    if (a.includes('UNVERIFY')) { return 'dismissed'; }
    return 'reason';
  }

  toggleVerified(u: UserDetail): void {
    this.run(this.api.setVerified(u.id, !u.verified), u.verified ? 'Verified badge removed.' : 'Verified badge granted.');
  }

  riskClass(level: string): string {
    switch (level) {
      case 'HIGH': return 'banned';
      case 'MEDIUM': return 'pending';
      default: return 'active';
    }
  }

  suspend(): void {
    const u = this.user();
    if (!u) { return; }
    this.run(this.api.suspend(u.id, { reason: this.reason.trim(), days: this.days ? Number(this.days) : null }), 'User suspended.');
  }

  async ban(): Promise<void> {
    const u = this.user();
    if (!u) { return; }
    const res = await this.confirm.confirm({
      title: `Ban @${u.username}?`,
      message: 'They lose access immediately. Capture a reason for the audit log.',
      confirmLabel: 'Ban user',
      tone: 'danger',
      input: { label: 'Reason', placeholder: 'Why is this account being banned?', required: true, multiline: true },
    });
    if (!res.confirmed) { return; }
    this.run(this.api.ban(u.id, { reason: (res.value || this.reason).trim() }), 'User banned.');
  }

  reinstate(): void {
    const u = this.user();
    if (!u) { return; }
    this.run(this.api.reinstate(u.id), 'User reinstated.');
  }

  private run(obs: Observable<UserDetail>, okMsg = 'Done.'): void {
    this.busy.set(true);
    obs.subscribe({
      next: (u) => { this.busy.set(false); this.user.set(u); this.reason = ''; this.days = ''; this.toast.success(okMsg); },
      error: () => { this.busy.set(false); this.toast.error('Action failed — check the admin API / internal hook.'); },
    });
  }

  initials(u: UserDetail): string {
    const base = this.fullName(u) || u.username || '?';
    return base.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  fullName(u: UserDetail): string {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
  }

  statusClass(s: string): string {
    switch (s) {
      case 'ACTIVE': return 'active';
      case 'SUSPENDED': return 'pending';
      case 'BANNED': return 'banned';
      default: return 'dismissed';
    }
  }

  sanctionClass(t: string): string {
    switch (t) {
      case 'BAN': return 'banned';
      case 'SUSPEND': return 'pending';
      case 'REINSTATE': return 'active';
      default: return 'reason';
    }
  }
}
