import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ChartComponent } from '../../shared/chart';
import { IconComponent } from '../../shared/icon';
import { InputComponent, TextareaComponent } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';
import { UsersApi } from '../../core/users.api';
import { AuthService } from '../../core/auth.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { AuditEntryRow, UserBilling, UserContentRow, UserDetail, UserInsights, UserReportRow } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { UserBillingTabComponent } from './user-billing-tab.component';
import { UserContentTabComponent } from './user-content-tab.component';
import { UserReportsTabComponent } from './user-reports-tab.component';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, IconComponent, InputComponent, TextareaComponent, TableComponent, ChartComponent, UserContentTabComponent, UserBillingTabComponent, UserReportsTabComponent],
  template: `
    <a routerLink="/users" class="back">‹ Back to users</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (user(); as u) {
      <div class="card phero">
        @if (u.photoUrl) {
          <img class="big pic" [src]="u.photoUrl" [alt]="'@' + u.username" referrerpolicy="no-referrer" />
        } @else {
          <span class="big">{{ initials(u) }}</span>
        }
        <div class="pf-id">
          <div class="nameln">
            <h1>{{ fullName(u) === '—' ? ('@' + u.username) : fullName(u) }}</h1>
            @if (u.verified) { <span class="vf" title="Verified">✓</span> }
            @if (u.subscription?.planCode) { <span class="pill resolved">{{ u.subscription!.planCode | titlecase }}</span> }
            <span class="pill" [class]="statusClass(u.accountStatus)">{{ u.accountStatus | titlecase }}</span>
          </div>
          <div class="handle">{{ '@' + u.username }} · {{ u.email }}@if (platform(); as pl) { · {{ pl }} }</div>
          <div class="statstrip">
            <div class="st"><b>{{ fmt(insights()?.followers) }}</b><span>Followers</span></div>
            <div class="st"><b>{{ fmt(insights()?.following) }}</b><span>Following</span></div>
            <div class="st"><b>{{ fmt(insights()?.posts) }}</b><span>Posts</span></div>
            <div class="st"><b [class.rose]="(insights()?.reportsAgainst ?? 0) > 0">{{ fmt(insights()?.reportsAgainst) }}</b><span>Reports</span></div>
            <div class="st"><b [class.amber]="(insights()?.sanctionCount ?? 0) > 0">{{ fmt(insights()?.sanctionCount) }}</b><span>Sanctions</span></div>
            <div class="st"><b>{{ u.createdAt | date: 'MMM y' }}</b><span>Member since</span></div>
          </div>
        </div>
      </div>

      <div class="subtabs" style="margin-bottom:18px">
        <button [class.on]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button [class.on]="tab() === 'content'" (click)="showContent()">Content@if (insights()?.posts) { · {{ insights()!.posts }} }</button>
        <button [class.on]="tab() === 'billing'" (click)="showBilling()">Billing</button>
        <button [class.on]="tab() === 'reports'" (click)="showReports()">Reports &amp; sanctions@if (reportsSanctionsCount()) { · {{ reportsSanctionsCount() }} }</button>
        <button [class.on]="tab() === 'devices'" (click)="showDevices()">Devices &amp; data</button>
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
              <div><span>Verified</span><b>{{ u.verified ? '✓ yes' : 'no' }}</b></div>
              @if (u.suspendedUntil) { <div><span>Suspended until</span><b>{{ u.suspendedUntil | date: 'MMM d, y, HH:mm' }}</b></div> }
              @if (u.statusReason) { <div><span>Reason</span><b>{{ u.statusReason }}</b></div> }
            </div>
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Activity</h3><span class="hint">last 90 days</span></div>
            @if ((insights()?.activity?.length ?? 0) > 0) {
              <ui-chart type="area" [series]="activitySeries()" [categories]="activityCats()" [colors]="['--cyan']" [height]="220" />
            } @else { <div class="empty">No recent activity.</div> }
          </div>
        </div>

        <div>
          @if (insights(); as ins) {
            <div class="card" style="margin-bottom:18px">
              <div class="card-h"><h3>Risk</h3><span class="pill" [class]="riskClass(ins.riskLevel)">{{ ins.riskLevel | titlecase }}</span></div>
              <div class="sig"><span class="ic tint-rose"><lucide-icon name="triangle-alert" [size]="14" /></span><span class="lab">Risk score</span><div class="meter"><i [class]="riskClass(ins.riskLevel)" [style.width.%]="ins.riskScore"></i></div><b>{{ ins.riskScore }}</b></div>
              <div class="sig"><span class="ic tint-amber"><lucide-icon name="flag" [size]="14" /></span><span class="lab">Reports</span><div class="meter"><i class="pending" [style.width.%]="pct(ins.reportsAgainst, 10)"></i></div><b>{{ ins.reportsAgainst }}</b></div>
              <div class="sig"><span class="ic tint-violet"><lucide-icon name="ban" [size]="14" /></span><span class="lab">Sanctions</span><div class="meter"><i class="banned" [style.width.%]="pct(ins.sanctionCount, 5)"></i></div><b>{{ ins.sanctionCount }}</b></div>
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

      @if (tab() === 'content') {
        @if (contentLoading()) { <div class="card"><div class="empty">Loading…</div></div> }
        @else { <app-user-content-tab [items]="content()" /> }
      }

      @if (tab() === 'billing') {
        @if (billingLoading()) { <div class="card"><div class="empty">Loading…</div></div> }
        @else { <app-user-billing-tab [billing]="billing()" [sub]="u.subscription" /> }
      }

      @if (tab() === 'reports') {
        @if (reportsLoading()) { <div class="card"><div class="empty">Loading…</div></div> }
        @else { <app-user-reports-tab [reports]="reports()" [sanctions]="u.sanctions" /> }
      }

      @if (tab() === 'devices') {
        <div class="grid">
          <div>
            <div class="card">
              <div class="card-h"><h3>Devices &amp; sessions</h3><span class="hint">{{ insights()?.devices?.length ?? 0 }}</span></div>
              <ui-table [columns]="deviceCols" [flush]="true" [empty]="(insights()?.devices?.length ?? 0) === 0" emptyText="No devices on record.">
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
          </div>
          <div>
            <div class="card">
              <div class="card-h"><h3>Account history</h3><span class="hint">admin actions</span></div>
              @if (auditLoading()) {
                <div class="empty">Loading…</div>
              } @else if (audit().length) {
                <div class="timeline" style="margin-top:6px">
                  @for (a of audit(); track a.id) {
                    <div class="tl">
                      <div class="when">{{ a.createdAt | date: 'MMM d, y, HH:mm' }} · {{ dir.name(a.adminUserId) }}</div>
                      <div class="what" style="display:flex;align-items:center;gap:8px;margin-top:4px">
                        <span class="pill" [class]="auditClass(a.action)">{{ prettyAction(a.action) }}</span>
                        <span class="muted">{{ a.summary || '—' }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty">No admin actions recorded.</div>
              }
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }

    /* premium profile hero */
    .phero { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 20px; }
    .big { width: 64px; height: 64px; flex: 0 0 auto; border-radius: 18px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; color: #fff; font-family: var(--sans); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; box-shadow: var(--shadow-sm); }
    .big.pic { object-fit: cover; background: var(--surface-2); }
    .pf-id { min-width: 0; flex: 1; }
    .nameln { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .nameln h1 { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0; letter-spacing: -0.02em; }
    .vf { color: var(--brand); font-weight: 800; font-size: 15px; }
    .handle { color: var(--muted-2); font-size: 12.5px; margin-top: 5px; word-break: break-word; }
    .statstrip { display: flex; flex-wrap: wrap; gap: 28px; margin-top: 18px; }
    .statstrip .st b { display: block; font-family: var(--sans); font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }
    .statstrip .st b.rose { color: var(--rose); } .statstrip .st b.amber { color: var(--amber); }
    .statstrip .st span { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); }

    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .meta > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .meta > div:last-child { border-bottom: 0; }
    .meta > div span { color: var(--muted-2); }
    .acts { display: flex; flex-direction: column; gap: 9px; margin-top: 14px; }

    /* risk signal meters */
    .sig { display: flex; align-items: center; gap: 11px; padding: 9px 0; font-size: 12.5px; }
    .sig .ic { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto; box-shadow: var(--shadow-sm); }
    .sig .lab { width: 84px; flex: 0 0 auto; color: var(--ink-2); }
    .sig .meter { flex: 1; height: 7px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
    .sig .meter i { display: block; height: 100%; border-radius: 5px; transition: width 0.3s var(--ease); }
    .sig .meter i.active { background: var(--green); } .sig .meter i.pending { background: var(--amber); } .sig .meter i.banned { background: var(--rose); }
    .sig b { width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class UserDetailComponent implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly dir = inject(AdminDirectoryService);

  readonly tab = signal<'overview' | 'content' | 'billing' | 'reports' | 'devices'>('overview');
  readonly audit = signal<AuditEntryRow[]>([]);
  readonly auditLoading = signal(false);
  private auditLoaded = false;
  readonly content = signal<UserContentRow[]>([]);
  readonly contentLoading = signal(false);
  private contentLoaded = false;
  readonly billing = signal<UserBilling | null>(null);
  readonly billingLoading = signal(false);
  private billingLoaded = false;
  readonly reports = signal<UserReportRow[]>([]);
  readonly reportsLoading = signal(false);
  private reportsLoaded = false;

  readonly user = signal<UserDetail | null>(null);
  readonly insights = signal<UserInsights | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('USERS:EDIT'));
  readonly reportsSanctionsCount = computed(() =>
    (this.insights()?.reportsAgainst ?? 0) + (this.user()?.sanctions?.length ?? 0));

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

  private userId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  showContent(): void {
    this.tab.set('content');
    if (this.contentLoaded) { return; }
    this.contentLoaded = true;
    this.contentLoading.set(true);
    this.api.content(this.userId()).subscribe({
      next: (r) => { this.content.set(r.items); this.contentLoading.set(false); },
      error: () => this.contentLoading.set(false),
    });
  }

  showBilling(): void {
    this.tab.set('billing');
    if (this.billingLoaded) { return; }
    this.billingLoaded = true;
    this.billingLoading.set(true);
    this.api.billing(this.userId()).subscribe({
      next: (b) => { this.billing.set(b); this.billingLoading.set(false); },
      error: () => this.billingLoading.set(false),
    });
  }

  showReports(): void {
    this.tab.set('reports');
    if (this.reportsLoaded) { return; }
    this.reportsLoaded = true;
    this.reportsLoading.set(true);
    this.api.reports(this.userId()).subscribe({
      next: (r) => { this.reports.set(r.items); this.reportsLoading.set(false); },
      error: () => this.reportsLoading.set(false),
    });
  }

  showDevices(): void {
    this.tab.set('devices');
    if (this.auditLoaded) { return; }
    this.auditLoaded = true;
    this.auditLoading.set(true);
    this.api.audit(this.userId(), 0, 50).subscribe({
      next: (p) => { this.audit.set(p.content); this.auditLoading.set(false); },
      error: () => this.auditLoading.set(false),
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

  /** A stat value formatted with thousands separators, or an em-dash before insights load. */
  fmt(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString();
  }

  /** Best-known client platform: subscription store, else most-recent device. */
  platform(): string | null {
    return this.user()?.subscription?.platform ?? this.insights()?.devices?.[0]?.platform ?? null;
  }

  /** Scale a small count to a 0–100% meter width (saturating at {@code max}). */
  pct(value: number, max: number): number {
    return Math.min(100, Math.round((value / max) * 100));
  }

  statusClass(s: string): string {
    switch (s) {
      case 'ACTIVE': return 'active';
      case 'SUSPENDED': return 'pending';
      case 'BANNED': return 'banned';
      default: return 'dismissed';
    }
  }

}
