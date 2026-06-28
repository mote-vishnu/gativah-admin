import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TableColumn, TableComponent } from '../../shared/table';
import { ClubsApi } from '../../core/clubs.api';
import { ClubDetail } from '../../core/models';

@Component({
  selector: 'app-club-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, RouterLink, TableComponent],
  template: `
    <a routerLink="/clubs" class="back">‹ Back to clubs</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (club(); as c) {
      <div class="head">
        <div>
          <h1 class="title">{{ c.name }}</h1>
          <p class="crumb">{{ c.visibility | titlecase }} · owner {{ c.ownerUsername ? '@' + c.ownerUsername : '—' }} · {{ c.memberCount }} members</p>
        </div>
        <span class="pill" [class]="c.removed ? 'banned' : 'active'">{{ c.removed ? 'Removed' : 'Active' }}</span>
      </div>

      @if (c.description) { <div class="card desc">{{ c.description }}</div> }

      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Members</h3><span class="hint">showing up to 50</span></div>
        <ui-table [columns]="memberCols" [flush]="true" [empty]="c.members.length === 0" emptyText="No members.">
          @for (m of c.members; track m.userId) {
            <tr>
              <td>{{ m.username ? '@' + m.username : '#' + m.userId }}</td>
              <td>{{ m.role | titlecase }}</td>
              <td><span class="pill" [class]="m.status === 'ACTIVE' ? 'active' : 'dismissed'">{{ m.status | titlecase }}</span></td>
              <td class="muted">{{ m.joinedAt ? (m.joinedAt | date: 'MMM d, y') : '—' }}</td>
            </tr>
          }
        </ui-table>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Events</h3><span class="hint">showing up to 50</span></div>
        <ui-table [columns]="eventCols" [flush]="true" [empty]="c.events.length === 0" emptyText="No events.">
          @for (e of c.events; track e.id) {
            <tr>
              <td><b>{{ e.title }}</b></td>
              <td>{{ e.kind | titlecase }}</td>
              <td class="muted">{{ e.startsAt ? (e.startsAt | date: 'MMM d, y, HH:mm') : '—' }}</td>
              <td><span class="count">{{ e.rsvpCount }}</span></td>
              <td><span class="pill" [class]="e.removed ? 'banned' : 'active'">{{ e.removed ? 'Removed' : 'Active' }}</span></td>
            </tr>
          }
        </ui-table>
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .desc { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; }
    .count { font-weight: 700; }
  `,
})
export class ClubDetailComponent implements OnInit {
  private readonly api = inject(ClubsApi);
  private readonly route = inject(ActivatedRoute);

  readonly club = signal<ClubDetail | null>(null);
  readonly error = signal<string | null>(null);

  readonly memberCols: TableColumn[] = [
    { label: 'Member' }, { label: 'Role' }, { label: 'Status' }, { label: 'Joined' },
  ];
  readonly eventCols: TableColumn[] = [
    { label: 'Event' }, { label: 'Kind' }, { label: 'Starts' }, { label: 'RSVPs' }, { label: 'Status' },
  ];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.detail(id).subscribe({
      next: (c) => this.club.set(c),
      error: () => this.error.set('Could not load this club.'),
    });
  }
}
