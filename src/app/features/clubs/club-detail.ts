import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { TableColumn, TableComponent } from '../../shared/table';
import { DefGridComponent, DefItemComponent, DetailHeaderComponent } from '../../shared/detail';
import { ClubsApi } from '../../core/clubs.api';
import { AuthService } from '../../core/auth.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuditEntryRow, ClubDetail } from '../../core/models';

@Component({
  selector: 'app-club-detail',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, RouterLink, IconComponent, TableComponent,
    DetailHeaderComponent, DefGridComponent, DefItemComponent,
  ],
  template: `
    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (club(); as c) {
      <ui-detail-header backLink="/clubs" backLabel="Back to clubs" [avatar]="initials(c.name)"
                        [tint]="c.removed ? 'rose' : 'green'" [title]="c.name"
                        [subtitle]="(c.visibility | titlecase) + ' · owner ' + (c.ownerUsername ? '@' + c.ownerUsername : '—') + ' · ' + c.memberCount + ' members'">
        <span detail-status class="pill" [class]="c.removed ? 'banned' : 'active'">{{ c.removed ? 'Removed' : 'Active' }}</span>
        <div detail-actions>
          @if (canEdit()) {
            @if (c.removed) {
              <button class="btn" (click)="restore(c)" [disabled]="busy()"><lucide-icon name="check" [size]="15" /> Restore club</button>
            } @else {
              <button class="btn danger" (click)="remove(c)" [disabled]="busy()"><lucide-icon name="ban" [size]="15" /> Remove club</button>
            }
          }
        </div>
      </ui-detail-header>

      <div class="subtabs" style="margin-bottom:18px">
        <button [class.on]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button [class.on]="tab() === 'audit'" (click)="showAudit()">Audit trail</button>
      </div>

      @if (tab() === 'overview') {
      <div class="card about">
        <div class="card-h"><h3>About this club</h3><span class="hint">read-only · owned by the creator</span></div>
        <ui-def-grid>
          <ui-def-item label="Visibility"><span class="pill" [class]="c.visibility === 'PRIVATE' ? 'review' : 'active'">{{ c.visibility | titlecase }}</span></ui-def-item>
          <ui-def-item label="Owner">{{ c.ownerUsername ? '@' + c.ownerUsername : '—' }}</ui-def-item>
          <ui-def-item label="Created">{{ c.createdAt ? (c.createdAt | date: 'MMM d, y') : '—' }}</ui-def-item>
          <ui-def-item label="Description" [muted]="!c.description">{{ c.description || 'No description' }}</ui-def-item>
        </ui-def-grid>
      </div>

      @if (c.insights; as ins) {
        <div class="card insights">
          <div class="ins"><span class="k">Owners</span><b>{{ ins.owners }}</b></div>
          <div class="ins"><span class="k">Admins</span><b>{{ ins.admins }}</b></div>
          <div class="ins"><span class="k">Members</span><b>{{ ins.regularMembers }}</b></div>
          <div class="ins"><span class="k">Pending</span><b [class.warn]="ins.pendingMembers > 0">{{ ins.pendingMembers }}</b></div>
          <div class="ins"><span class="k">New · 30d</span><b>{{ ins.newMembers30d }}</b></div>
          <div class="ins"><span class="k">Upcoming events</span><b>{{ ins.upcomingEvents }}</b></div>
          <div class="ins"><span class="k">Past events</span><b>{{ ins.pastEvents }}</b></div>
          <div class="ins"><span class="k">Total RSVPs</span><b>{{ ins.totalRsvps }}</b></div>
        </div>
      }

      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Members</h3><span class="hint">showing up to 50</span></div>
        <ui-table [columns]="memberCols()" [flush]="true" [empty]="c.members.length === 0" emptyText="No members.">
          @for (m of c.members; track m.userId) {
            <tr>
              <td><a [routerLink]="['/users', m.userId]">{{ m.username ? '@' + m.username : '#' + m.userId }}</a></td>
              <td>{{ m.role | titlecase }}</td>
              <td><span class="pill" [class]="m.status === 'ACTIVE' ? 'active' : 'dismissed'">{{ m.status | titlecase }}</span></td>
              <td class="muted">{{ m.joinedAt ? (m.joinedAt | date: 'MMM d, y') : '—' }}</td>
              @if (canEdit()) {
                <td class="rowact">
                  @if (m.role !== 'OWNER') {
                    <button class="link danger" (click)="removeMember(c, m)" [disabled]="busy()">Remove</button>
                  } @else { <span class="muted">—</span> }
                </td>
              }
            </tr>
          }
        </ui-table>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Events</h3><span class="hint">showing up to 50</span></div>
        <ui-table [columns]="eventCols()" [flush]="true" [empty]="c.events.length === 0" emptyText="No events.">
          @for (e of c.events; track e.id) {
            <tr>
              <td><b>{{ e.title }}</b></td>
              <td>{{ e.kind | titlecase }}</td>
              <td class="muted">{{ e.startsAt ? (e.startsAt | date: 'MMM d, y, HH:mm') : '—' }}</td>
              <td><span class="count">{{ e.rsvpCount }}</span></td>
              <td><span class="pill" [class]="e.removed ? 'banned' : 'active'">{{ e.removed ? 'Removed' : 'Active' }}</span></td>
              @if (canEdit()) {
                <td class="rowact">
                  @if (!e.removed) {
                    <button class="link danger" (click)="removeEvent(c, e)" [disabled]="busy()">Remove</button>
                  } @else { <span class="muted">—</span> }
                </td>
              }
            </tr>
          }
        </ui-table>
      </div>
      }

      @if (tab() === 'audit') {
        <div class="card">
          <div class="card-h"><h3>Audit trail</h3><span class="hint">admin actions taken on this club</span></div>
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
            <div class="empty">No admin actions recorded for this club.</div>
          }
        </div>
      }
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .head-r { display: flex; align-items: center; gap: 12px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .count { font-weight: 700; }
    .about { margin-bottom: 18px; }
    .insights { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 0; overflow: hidden; }
    @media (max-width: 720px) { .insights { grid-template-columns: repeat(2, 1fr); } }
    .insights .ins { padding: 15px 18px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .insights .ins:nth-child(4n) { border-right: 0; }
    .insights .ins:nth-child(n+5) { border-bottom: 0; }
    .insights .ins .k { display: block; font-size: 11px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
    .insights .ins b { font-family: var(--sans); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .insights .ins b.warn { color: var(--amber); }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .rowact { text-align: right; white-space: nowrap; }
    .link { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
    .link.danger { color: var(--rose); } .link.danger:hover { text-decoration: underline; }
  `,
})
export class ClubDetailComponent implements OnInit {
  private readonly api = inject(ClubsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly dir = inject(AdminDirectoryService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly club = signal<ClubDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tab = signal<'overview' | 'audit'>('overview');
  readonly audit = signal<AuditEntryRow[]>([]);
  readonly auditLoading = signal(false);
  private auditLoaded = false;

  readonly canEdit = computed(() => this.auth.can('CLUBS:EDIT'));
  readonly memberCols = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [{ label: 'Member' }, { label: 'Role' }, { label: 'Status' }, { label: 'Joined' }];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });
  readonly eventCols = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [{ label: 'Event' }, { label: 'Kind' }, { label: 'Starts' }, { label: 'RSVPs' }, { label: 'Status' }];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.detail(id).subscribe({
      next: (c) => this.club.set(c),
      error: () => this.error.set('Could not load this club.'),
    });
  }

  initials(name: string): string {
    return (name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  async remove(c: ClubDetail): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Remove "${c.name}"?`,
      message: 'The club is hidden from members. You can restore it later.',
      confirmLabel: 'Remove club',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'Why is this club being removed?', multiline: true },
    });
    if (!res.confirmed) { return; }
    this.run(this.api.remove(c.id, res.value ?? null), 'Club removed.');
  }

  restore(c: ClubDetail): void {
    this.run(this.api.restore(c.id), 'Club restored.');
  }

  async removeMember(c: ClubDetail, m: { userId: number | null; username: string | null }): Promise<void> {
    if (m.userId == null) { return; }
    const res = await this.confirm.confirm({
      title: `Remove ${m.username ? '@' + m.username : 'member #' + m.userId}?`,
      message: 'They are removed from this club.',
      confirmLabel: 'Remove member',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.run(this.api.removeMember(c.id, m.userId), 'Member removed.');
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
    return a.replace(/^CLUB_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  auditClass(a: string): string {
    if (a.includes('REMOVE')) { return 'banned'; }
    if (a.includes('RESTORE')) { return 'active'; }
    if (a.includes('ROLE')) { return 'pending'; }
    return 'reason';
  }

  async removeEvent(c: ClubDetail, e: { id: number; title: string }): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Remove event "${e.title}"?`,
      confirmLabel: 'Remove event',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'Why is this event being removed?' },
    });
    if (!res.confirmed) { return; }
    this.run(this.api.removeEvent(c.id, e.id, res.value ?? null), 'Event removed.');
  }

  private run(obs: ReturnType<ClubsApi['detail']>, okMsg: string): void {
    this.busy.set(true);
    obs.subscribe({
      next: (c) => { this.busy.set(false); this.club.set(c); this.toast.success(okMsg); },
      error: () => { this.busy.set(false); this.toast.error('Action failed — check the admin API / internal hook.'); },
    });
  }
}
