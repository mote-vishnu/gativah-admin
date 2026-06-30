import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MultiSelectComponent, SelectOption } from '../../shared/forms';
import { SearchBarComponent } from '../../shared/search-bar.component';
import { ErrorBannerComponent } from '../../shared/feedback';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, SortState, TableColumn, TableComponent } from '../../shared/table';
import { ClubsApi } from '../../core/clubs.api';
import { ExportService } from '../../core/export.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ClubStats, ClubSummary, Page } from '../../core/models';

const VISIBILITY_OPTIONS: SelectOption[] = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
];
const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REMOVED', label: 'Removed' },
];

@Component({
  selector: 'app-clubs-list',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, SearchBarComponent, ErrorBannerComponent, MultiSelectComponent, IconComponent, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="users-round" title="Clubs" subtitle="Community directory"
                    tint="green" [count]="page()?.totalElements ?? null">
      <button page-actions class="btn" (click)="exportCsv()" [disabled]="(page()?.content?.length ?? 0) === 0">
        <lucide-icon name="download" [size]="15" /> Export
      </button>
    </ui-page-header>

    @if (stats(); as st) {
      <div class="row g5" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="users-round" [size]="16" /></span> Clubs</div><div class="val c-green">{{ st.totalClubs }}</div><div class="delta flat">{{ st.activeClubs }} active · {{ st.removedClubs }} removed</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="users" [size]="16" /></span> Members</div><div class="val c-cyan">{{ st.totalMembers }}</div><div class="delta flat">avg {{ st.avgMembers }} · largest {{ st.largestClubMembers }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="shield-check" [size]="16" /></span> Private</div><div class="val c-violet">{{ st.privateClubs }}</div><div class="delta flat">of {{ st.totalClubs }} clubs</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="calendar" [size]="16" /></span> Upcoming events</div><div class="val c-amber">{{ st.upcomingEvents }}</div><div class="delta flat">scheduled ahead</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="plus-circle" [size]="16" /></span> New · 30d</div><div class="val c-orange">{{ st.newClubs30d }}</div><div class="delta flat">created recently</div></div>
      </div>
    }

    <div class="toolbar">
      <div class="search"><ui-search-bar placeholder="Search club name…" [(ngModel)]="q" (search)="onSearch($event)" /></div>
      <div class="filt"><ui-multiselect placeholder="All visibility" [options]="visibilityOptions" [(ngModel)]="visibilitySel" (ngModelChange)="applyFilter()" /></div>
      <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
    </div>

    <ui-error-banner [message]="error() ?? ''" />

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No clubs found."
              [sort]="sort()" (sortChange)="onSort($event)">
      @for (cl of page()?.content ?? []; track cl.id) {
        <tr class="clickable" (click)="open(cl)">
          <td><b>{{ cl.name }}</b></td>
          <td>{{ cl.ownerUsername ? '@' + cl.ownerUsername : '—' }}</td>
          <td>{{ cl.visibility | titlecase }}</td>
          <td><span class="count">{{ cl.memberCount }}</span></td>
          <td><span class="count">{{ cl.eventCount }}</span></td>
          <td><span class="pill" [class]="cl.removed ? 'banned' : 'active'">{{ cl.removed ? 'Removed' : 'Active' }}</span></td>
          <td class="muted">{{ cl.createdAt | date: 'MMM d, y' }}</td>
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="club"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 300px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .count { font-weight: 700; }
  `,
})
export class ClubsListComponent implements OnInit {
  private readonly api = inject(ClubsApi);
  private readonly router = inject(Router);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);

  readonly visibilityOptions = VISIBILITY_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;
  visibilitySel: string[] = [];
  statusSel: string[] = [];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ClubSummary> | null>(null);
  readonly stats = signal<ClubStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sort = signal<SortState | null>(null);
  q = '';

  readonly columns: TableColumn[] = [
    { label: 'Club', sortKey: 'name' }, { label: 'Owner' }, { label: 'Visibility', sortKey: 'visibility' },
    { label: 'Members', sortKey: 'members' }, { label: 'Events', sortKey: 'events' }, { label: 'Status' }, { label: 'Created', sortKey: 'createdAt' },
  ];

  ngOnInit(): void {
    this.load();
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    const s = this.sort();
    this.api.list({
      q: this.q.trim() || null,
      visibility: this.visibilitySel,
      status: this.statusSel,
      sort: s ? `${s.key},${s.dir}` : null,
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load clubs (needs CLUBS:VIEW).'); this.loading.set(false); },
    });
  }

  search(): void { this.pageIndex.set(0); this.load(); }
  onSearch(v: string): void { this.q = v; this.pageIndex.set(0); this.load(); }
  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }
  onSort(s: SortState): void { this.sort.set(s); this.pageIndex.set(0); this.load(); }

  exportCsv(): void {
    const rows = (this.page()?.content ?? []).map((cl) => ({
      id: cl.id, name: cl.name, owner: cl.ownerUsername ?? '', visibility: cl.visibility,
      members: cl.memberCount, events: cl.eventCount, status: cl.removed ? 'Removed' : 'Active', created: cl.createdAt,
    }));
    if (!rows.length) { return; }
    this.exporter.download('clubs', [
      { key: 'id', label: 'ID' }, { key: 'name', label: 'Club' }, { key: 'owner', label: 'Owner' },
      { key: 'visibility', label: 'Visibility' }, { key: 'members', label: 'Members' }, { key: 'events', label: 'Events' },
      { key: 'status', label: 'Status' }, { key: 'created', label: 'Created' },
    ], rows);
    this.toast.info(`Exported ${rows.length} club(s).`);
  }

  open(cl: ClubSummary): void { void this.router.navigate(['/clubs', cl.id]); }
}
