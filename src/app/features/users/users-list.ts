import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, SortState, TableColumn, TableComponent } from '../../shared/table';
import { UsersApi } from '../../core/users.api';
import { ExportService } from '../../core/export.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Page, UserSummary } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
];

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, InputComponent, MultiSelectComponent, IconComponent, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="users" title="Users" subtitle="Member directory & account actions"
                    tint="cyan" [count]="page()?.totalElements ?? null">
      <button page-actions class="btn" (click)="exportCsv()" [disabled]="(page()?.content?.length ?? 0) === 0">
        <lucide-icon name="download" [size]="15" /> Export
      </button>
    </ui-page-header>

    <div class="toolbar">
      <div class="search"><ui-input placeholder="Search username or email…" [(ngModel)]="q" (enter)="search()" /></div>
      <div class="filt">
        <ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" />
      </div>
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No users found."
              [sort]="sort()" (sortChange)="onSort($event)">
      @for (u of page()?.content ?? []; track u.id) {
        <tr class="clickable" (click)="open(u)">
          <td>
            <div class="u">
              <span class="av">{{ initials(u) }}</span>
              <div class="nm"><b>{{ '@' + u.username }}</b><span>{{ u.fullName || '—' }}</span></div>
            </div>
          </td>
          <td class="muted">{{ u.email }}</td>
          <td><span class="pill" [class]="statusClass(u.accountStatus)">{{ u.accountStatus | titlecase }}</span></td>
          <td>{{ u.subscriptionState ? (u.subscriptionState | titlecase) : '—' }}</td>
          <td>{{ u.verified ? '✓' : '—' }}</td>
          <td class="muted">{{ u.createdAt | date: 'MMM d, y' }}</td>
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="user"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 320px; max-width: 100%; }
    .toolbar .filt { width: 240px; max-width: 100%; }
    .u { display: flex; align-items: center; gap: 10px; }
    .av { width: 30px; height: 30px; border-radius: 9px; background: var(--av); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .nm b { font-size: 13px; } .nm span { display: block; font-size: 11px; color: var(--muted-2); }
  `,
})
export class UsersListComponent implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;
  statusSel: string[] = [];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<UserSummary> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sort = signal<SortState | null>(null);
  q = '';

  readonly columns: TableColumn[] = [
    { label: 'User', sortKey: 'username' }, { label: 'Email', sortKey: 'email' }, { label: 'Status', sortKey: 'status' },
    { label: 'Subscription' }, { label: 'Verified', sortKey: 'verified' }, { label: 'Joined', sortKey: 'createdAt' },
  ];

  ngOnInit(): void {
    // Hydrate filters from the URL so the list is shareable / survives refresh + back.
    const qp = this.route.snapshot.queryParamMap;
    this.q = qp.get('q') ?? '';
    this.statusSel = qp.get('status') ? qp.get('status')!.split(',').filter(Boolean) : [];
    const sort = qp.get('sort');
    if (sort) {
      const [key, dir] = sort.split(',');
      if (key) { this.sort.set({ key, dir: dir === 'desc' ? 'desc' : 'asc' }); }
    }
    this.pageIndex.set(Math.max(0, Number(qp.get('page') ?? 0)));
    this.load();
  }

  private syncUrl(): void {
    const s = this.sort();
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        q: this.q.trim() || null,
        status: this.statusSel.length ? this.statusSel.join(',') : null,
        sort: s ? `${s.key},${s.dir}` : null,
        page: this.pageIndex() || null,
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.syncUrl();
    const s = this.sort();
    this.api.list({
      q: this.q.trim() || null,
      status: this.statusSel,
      sort: s ? `${s.key},${s.dir}` : null,
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load users (needs USERS:VIEW).'); this.loading.set(false); },
    });
  }

  search(): void { this.pageIndex.set(0); this.load(); }
  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }
  onSort(s: SortState): void { this.sort.set(s); this.pageIndex.set(0); this.load(); }

  exportCsv(): void {
    const rows = (this.page()?.content ?? []).map((u) => ({
      id: u.id, username: u.username, fullName: u.fullName ?? '', email: u.email,
      status: u.accountStatus, subscription: u.subscriptionState ?? '', verified: u.verified ? 'yes' : 'no', joined: u.createdAt,
    }));
    if (!rows.length) { return; }
    this.exporter.download('users', [
      { key: 'id', label: 'ID' }, { key: 'username', label: 'Username' }, { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'subscription', label: 'Subscription' },
      { key: 'verified', label: 'Verified' }, { key: 'joined', label: 'Joined' },
    ], rows);
    this.toast.info(`Exported ${rows.length} user(s).`);
  }

  open(u: UserSummary): void { void this.router.navigate(['/users', u.id]); }

  initials(u: UserSummary): string {
    const base = u.fullName || u.username || '?';
    return base.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
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
