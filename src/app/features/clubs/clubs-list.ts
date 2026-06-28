import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { ClubsApi } from '../../core/clubs.api';
import { ClubSummary, Page } from '../../core/models';

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
  imports: [FormsModule, DatePipe, TitleCasePipe, InputComponent, MultiSelectComponent, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="users-round" title="Clubs" subtitle="Community directory"
                    tint="green" [count]="page()?.totalElements ?? null" />

    <div class="toolbar">
      <div class="search"><ui-input placeholder="Search club name…" [(ngModel)]="q" (enter)="search()" /></div>
      <div class="filt"><ui-multiselect placeholder="All visibility" [options]="visibilityOptions" [(ngModel)]="visibilitySel" (ngModelChange)="applyFilter()" /></div>
      <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No clubs found.">
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

  readonly visibilityOptions = VISIBILITY_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;
  visibilitySel: string[] = [];
  statusSel: string[] = [];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ClubSummary> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  q = '';

  readonly columns: TableColumn[] = [
    { label: 'Club' }, { label: 'Owner' }, { label: 'Visibility' },
    { label: 'Members' }, { label: 'Events' }, { label: 'Status' }, { label: 'Created' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list({
      q: this.q.trim() || null,
      visibility: this.visibilitySel,
      status: this.statusSel,
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load clubs (needs CLUBS:VIEW).'); this.loading.set(false); },
    });
  }

  search(): void { this.pageIndex.set(0); this.load(); }
  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  open(cl: ClubSummary): void { void this.router.navigate(['/clubs', cl.id]); }
}
