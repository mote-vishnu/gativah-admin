import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { TableColumn, TableComponent } from '../../shared/table';
import { DefGridComponent, DefItemComponent, DetailHeaderComponent } from '../../shared/detail';
import { ClubsApi } from '../../core/clubs.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ClubEventDetail, RoutePoint } from '../../core/models';

interface PathPoint { x: number; y: number; }

@Component({
  selector: 'app-club-event-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, RouterLink, IconComponent, TableComponent, DetailHeaderComponent, DefGridComponent, DefItemComponent],
  template: `
    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (event(); as e) {
      <ui-detail-header [backLink]="'/clubs/' + clubId()" backLabel="Back to club"
                        [avatar]="e.kind === 'RACE' ? 'R' : 'S'" [tint]="e.kind === 'RACE' ? 'orange' : 'cyan'"
                        [title]="e.title"
                        [subtitle]="(e.kind | titlecase) + ' · ' + (e.startsAt ? (e.startsAt | date: 'MMM d, y · HH:mm') : 'no date') + (e.location ? ' · ' + e.location : '')">
        <span detail-status class="pill" [class]="statusClass(e)">{{ status(e) }}</span>
        <div detail-actions>
          @if (canEdit()) {
            @if (e.removed) {
              <button class="btn" (click)="restore(e)" [disabled]="busy()"><lucide-icon name="check" [size]="15" /> Restore event</button>
            } @else {
              <button class="btn danger" (click)="remove(e)" [disabled]="busy()"><lucide-icon name="ban" [size]="15" /> Remove event</button>
            }
          }
        </div>
      </ui-detail-header>

      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="check" [size]="16" /></span> Going</div><div class="val c-green">{{ e.rsvpGoing }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="users" [size]="16" /></span> Maybe</div><div class="val c-amber">{{ e.rsvpMaybe }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="ban" [size]="16" /></span> Declined</div><div class="val c-rose">{{ e.rsvpDeclined }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="globe" [size]="16" /></span> Route points</div><div class="val c-cyan">{{ e.route.length }}</div></div>
      </div>

      <div class="subtabs" style="margin-bottom:18px">
        <button [class.on]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button [class.on]="tab() === 'attendees'" (click)="tab.set('attendees')">Attendees</button>
        <button [class.on]="tab() === 'route'" (click)="tab.set('route')">Route</button>
      </div>

      @if (tab() === 'overview') {
        <div class="card">
          <div class="card-h"><h3>Event details</h3><span class="hint">read-only · created by the club</span></div>
          <ui-def-grid>
            <ui-def-item label="Kind">{{ e.kind | titlecase }}</ui-def-item>
            <ui-def-item label="Location" [muted]="!e.location">{{ e.location || '—' }}</ui-def-item>
            <ui-def-item label="Starts">{{ e.startsAt ? (e.startsAt | date: 'MMM d, y · HH:mm') : '—' }}</ui-def-item>
            <ui-def-item label="Ends">{{ e.endsAt ? (e.endsAt | date: 'MMM d, y · HH:mm') : '—' }}</ui-def-item>
            <ui-def-item label="Distance" [muted]="!e.distanceM">{{ distance(e.distanceM) }}</ui-def-item>
            <ui-def-item label="Created by">@if (e.createdByUserId) { <a [routerLink]="['/users', e.createdByUserId]">{{ e.createdByUsername ? '@' + e.createdByUsername : '#' + e.createdByUserId }}</a> } @else { — }</ui-def-item>
            <ui-def-item label="Created">{{ e.createdAt ? (e.createdAt | date: 'MMM d, y') : '—' }}</ui-def-item>
            <ui-def-item label="Description" [muted]="!e.description">{{ e.description || 'No description' }}</ui-def-item>
          </ui-def-grid>
        </div>
      }

      @if (tab() === 'attendees') {
        <div class="card">
          <div class="card-h"><h3>Attendees</h3><span class="hint">RSVPs · showing up to 200</span></div>
          <ui-table [columns]="rsvpCols" [flush]="true" [empty]="e.rsvps.length === 0" emptyText="No RSVPs yet.">
            @for (r of e.rsvps; track r.userId) {
              <tr>
                <td>@if (r.userId) { <a [routerLink]="['/users', r.userId]">{{ r.username ? '@' + r.username : '#' + r.userId }}</a> } @else { — }</td>
                <td><span class="pill" [class]="rsvpClass(r.status)">{{ r.status | titlecase }}</span></td>
                <td class="muted">{{ r.respondedAt ? (r.respondedAt | date: 'MMM d, y, HH:mm') : '—' }}</td>
              </tr>
            }
          </ui-table>
        </div>
      }

      @if (tab() === 'route') {
        <div class="card">
          <div class="card-h"><h3>Planned route</h3><span class="hint">{{ e.route.length }} points{{ e.distanceM ? ' · ' + distance(e.distanceM) : '' }}</span></div>
          @if (e.route.length >= 2) {
            <svg class="routemap" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet">
              <polyline class="rline" [attr.points]="polyline(e.route)" />
              <circle class="rstart" [attr.cx]="pts()[0].x" [attr.cy]="pts()[0].y" r="5" />
              <circle class="rend" [attr.cx]="pts()[pts().length - 1].x" [attr.cy]="pts()[pts().length - 1].y" r="5" />
            </svg>
            <div class="legend"><span><i class="dot g"></i> Start</span><span><i class="dot r"></i> Finish</span></div>
          } @else {
            <div class="empty">No route recorded for this event.</div>
          }
        </div>
      }
    }
  `,
  styles: `
    .kpi .val.c-green { color: var(--green); } .kpi .val.c-amber { color: var(--amber); } .kpi .val.c-rose { color: var(--rose); } .kpi .val.c-cyan { color: var(--cyan); }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .routemap { width: 100%; height: 300px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; margin-top: 6px; }
    .routemap .rline { fill: none; stroke: var(--brand); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .routemap .rstart { fill: var(--green); } .routemap .rend { fill: var(--rose); }
    .legend { display: flex; gap: 18px; margin-top: 12px; font-size: 12px; color: var(--muted-2); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .legend .dot.g { background: var(--green); } .legend .dot.r { background: var(--rose); }
    .empty { padding: 40px; text-align: center; color: var(--muted-2); font-size: 13px; }
  `,
})
export class ClubEventDetailComponent implements OnInit {
  private readonly api = inject(ClubsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly event = signal<ClubEventDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tab = signal<'overview' | 'attendees' | 'route'>('overview');
  readonly clubId = signal(0);

  readonly canEdit = computed(() => this.auth.can('CLUBS:EDIT'));
  readonly rsvpCols: TableColumn[] = [{ label: 'Member' }, { label: 'RSVP' }, { label: 'Responded' }];
  /** Cached projected route points for the SVG (start/end markers reference indices). */
  readonly pts = computed<PathPoint[]>(() => this.project(this.event()?.route ?? []));

  ngOnInit(): void {
    this.clubId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.load();
  }

  private load(): void {
    const id = this.clubId();
    const eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    this.api.eventDetail(id, eventId).subscribe({
      next: (e) => this.event.set(e),
      error: () => this.error.set('Could not load this event.'),
    });
  }

  status(e: ClubEventDetail): string {
    if (e.removed) { return 'Removed'; }
    if (e.startsAt && new Date(e.startsAt).getTime() < Date.now()) { return 'Past'; }
    return 'Upcoming';
  }

  statusClass(e: ClubEventDetail): string {
    const s = this.status(e);
    return s === 'Removed' ? 'banned' : s === 'Past' ? 'dismissed' : 'active';
  }

  rsvpClass(status: string): string {
    return status === 'GOING' ? 'active' : status === 'MAYBE' ? 'review' : 'dismissed';
  }

  distance(m: number | null): string {
    if (m == null) { return '—'; }
    return m >= 1000 ? (Math.round(m / 100) / 10) + ' km' : m + ' m';
  }

  /** Project lat/lng to a 400×240 viewBox (north up), padded. */
  private project(route: RoutePoint[]): PathPoint[] {
    if (route.length === 0) { return []; }
    const lats = route.map((p) => p.lat);
    const lngs = route.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;
    const pad = 20, w = 400 - pad * 2, h = 240 - pad * 2;
    return route.map((p) => ({
      x: pad + ((p.lng - minLng) / spanLng) * w,
      y: pad + (1 - (p.lat - minLat) / spanLat) * h,
    }));
  }

  polyline(_route: RoutePoint[]): string {
    return this.pts().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  async remove(e: ClubEventDetail): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Remove event "${e.title}"?`,
      message: 'The event is hidden from members. You can restore it later.',
      confirmLabel: 'Remove event',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'Why is this event being removed?' },
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.removeEvent(this.clubId(), e.id, res.value ?? null).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Event removed.'); this.load(); },
      error: () => { this.busy.set(false); this.toast.error('Action failed — check the admin API / internal hook.'); },
    });
  }

  restore(e: ClubEventDetail): void {
    this.busy.set(true);
    this.api.restoreEvent(this.clubId(), e.id).subscribe({
      next: (updated) => { this.busy.set(false); this.event.set(updated); this.toast.success('Event restored.'); },
      error: () => { this.busy.set(false); this.toast.error('Action failed — check the admin API / internal hook.'); },
    });
  }
}
