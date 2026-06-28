import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { InputComponent, TextareaComponent } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';
import { UsersApi } from '../../core/users.api';
import { AuthService } from '../../core/auth.service';
import { UserDetail } from '../../core/models';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, InputComponent, TextareaComponent, TableComponent],
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
              </div>
              <div class="note" style="margin-top:14px">⚠ Actions run via the internal hook on pacegrit-service and are written to the audit log.</div>
            </div>
          } @else {
            <div class="card"><div class="note">Read-only access to users (no USERS:EDIT).</div></div>
          }
        </div>
      </div>
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
  `,
})
export class UserDetailComponent implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly user = signal<UserDetail | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('USERS:EDIT'));

  readonly sanctionCols: TableColumn[] = [
    { label: 'Type' }, { label: 'Reason' }, { label: 'Until' }, { label: 'By' }, { label: 'When' },
  ];

  reason = '';
  days: string | number = '';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.detail(id).subscribe({
      next: (u) => this.user.set(u),
      error: () => this.error.set('Could not load this user.'),
    });
  }

  suspend(): void {
    const u = this.user();
    if (!u) { return; }
    this.run(this.api.suspend(u.id, { reason: this.reason.trim(), days: this.days ? Number(this.days) : null }));
  }

  ban(): void {
    const u = this.user();
    if (!u) { return; }
    if (!confirm(`Ban @${u.username}? They will lose access immediately.`)) { return; }
    this.run(this.api.ban(u.id, { reason: this.reason.trim() }));
  }

  reinstate(): void {
    const u = this.user();
    if (!u) { return; }
    this.run(this.api.reinstate(u.id));
  }

  private run(obs: Observable<UserDetail>): void {
    this.busy.set(true);
    this.error.set(null);
    obs.subscribe({
      next: (u) => { this.busy.set(false); this.user.set(u); this.reason = ''; this.days = ''; },
      error: () => { this.busy.set(false); this.error.set('Action failed — check the admin API / internal hook.'); },
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
