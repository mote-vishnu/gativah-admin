import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CheckboxComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { ModerationApi } from '../../core/moderation.api';
import { AuthService } from '../../core/auth.service';
import { Page, ReportSummary, ResolveAction } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];
const OVERDUE_HOURS = 24;

@Component({
  selector: 'app-moderation-list',
  standalone: true,
  template: `
    <ui-page-header icon="flag" title="Grievances" subtitle="Content reports & moderation"
                    tint="rose" [count]="page()?.totalElements ?? null" />

    <div class="filterbar">
      <ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" />
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    @if (canEdit() && selectedCount() > 0) {
      <div class="bulkbar">
        <span class="cnt">{{ selectedCount() }} selected</span>
        <div class="spacer"></div>
        <button class="btn" (click)="assignMe()" [disabled]="busy()"><lucide-icon name="user-plus" [size]="14" /> Assign to me</button>
        <button class="btn" (click)="bulk('DISMISS')" [disabled]="busy()"><lucide-icon name="check" [size]="14" /> Dismiss</button>
        <button class="btn danger" (click)="bulk('TAKEDOWN')" [disabled]="busy()"><lucide-icon name="flag" [size]="14" /> Take down</button>
        <button class="btn" (click)="clear()">Clear</button>
      </div>
    }

    <ui-table [columns]="columns()" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No reports.">
      @for (r of page()?.content ?? []; track r.id) {
        <tr class="clickable" (click)="open(r)">
          @if (canEdit()) {
            <td class="pick" (click)="$event.stopPropagation()">
              <ui-checkbox [checked]="selected().has(r.id)" (checkedChange)="toggle(r.id, $event)" />
            </td>
          }
          <td><b>{{ r.contentType | titlecase }}</b> · {{ snippet(r) }}</td>
          <td>{{ r.authorUsername ? '@' + r.authorUsername : '—' }}</td>
          <td>{{ r.reporterUsername ? '@' + r.reporterUsername : '—' }}</td>
          <td><span class="pill reason">{{ r.reason }}</span></td>
          <td><span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span></td>
          <td>{{ assigneeLabel(r) }}</td>
          <td class="muted">
            <div class="when">
              <span>{{ r.createdAt | date: 'MMM d, HH:mm' }}</span>
              <span class="age" [class.over]="isOverdue(r)">{{ age(r.createdAt) }}@if (isOverdue(r)) { · overdue }</span>
            </div>
          </td>
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="report"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .filterbar { width: 260px; max-width: 100%; margin-bottom: 18px; }
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .bulkbar { display: flex; align-items: center; gap: 9px; padding: 10px 14px; margin-bottom: 14px; border: 1px solid var(--brand-line); background: var(--brand-soft); border-radius: var(--r-sm); }
    .bulkbar .cnt { font-size: 13px; font-weight: 600; color: var(--brand); }
    .bulkbar .spacer { flex: 1; }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .pick { width: 1%; white-space: nowrap; }
    .when { display: flex; flex-direction: column; gap: 2px; }
    .age { font-size: 10.5px; color: var(--muted-2); }
    .age.over { color: var(--rose); font-weight: 600; }
  `,
  imports: [FormsModule, DatePipe, TitleCasePipe, TableComponent, PaginatorComponent, CheckboxComponent, IconComponent, MultiSelectComponent, PageHeaderComponent],
})
export class ModerationListComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly statusOptions = STATUS_OPTIONS;
  statusSel: string[] = ['PENDING'];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ReportSummary> | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly selected = signal<Set<number>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);
  readonly canEdit = computed(() => this.auth.can('GRIEVANCES:EDIT'));

  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Reported content' },
      { label: 'Author' },
      { label: 'Reporter' },
      { label: 'Reason' },
      { label: 'Status' },
      { label: 'Assignee' },
      { label: 'When' },
    ];
    return this.canEdit() ? [{ label: '', width: '1%' }, ...cols] : cols;
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.reports({ status: this.statusSel, page: this.pageIndex(), size: 20 }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load reports.'); this.loading.set(false); },
    });
  }

  applyFilter(): void {
    this.pageIndex.set(0);
    this.clear();
    this.load();
  }

  goTo(i: number): void { this.pageIndex.set(i); this.clear(); this.load(); }

  toggle(id: number, on: boolean): void {
    const next = new Set(this.selected());
    if (on) { next.add(id); } else { next.delete(id); }
    this.selected.set(next);
  }

  clear(): void { this.selected.set(new Set()); }

  bulk(action: ResolveAction): void {
    const ids = [...this.selected()];
    if (!ids.length) { return; }
    if (action === 'TAKEDOWN' && !confirm(`Take down content for ${ids.length} report(s)?`)) { return; }
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.bulkResolve({ ids, action }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.clear();
        this.message.set(`${res.resolved} resolved${res.failed ? `, ${res.failed} failed` : ''}.`);
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Bulk action failed.'); },
    });
  }

  assignMe(): void {
    const ids = [...this.selected()];
    if (!ids.length) { return; }
    const me = this.auth.me()?.id ?? null;
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.bulkAssign({ ids, adminId: me }).subscribe({
      next: () => {
        this.busy.set(false);
        this.clear();
        this.message.set(`${ids.length} report(s) assigned to you.`);
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Assign failed.'); },
    });
  }

  assigneeLabel(r: ReportSummary): string {
    if (r.assigneeAdminId == null) { return '—'; }
    return r.assigneeAdminId === this.auth.me()?.id ? 'you' : '#' + r.assigneeAdminId;
  }

  open(r: ReportSummary): void {
    void this.router.navigate(['/moderation', r.id]);
  }

  snippet(r: ReportSummary): string {
    return r.snippet ? r.snippet.slice(0, 60) : '(no preview)';
  }

  isOverdue(r: ReportSummary): boolean {
    if (r.status !== 'PENDING' && r.status !== 'REVIEWING') { return false; }
    return this.hoursSince(r.createdAt) > OVERDUE_HOURS;
  }

  age(iso: string): string {
    const h = this.hoursSince(iso);
    if (h < 1) { return `${Math.max(1, Math.round(h * 60))}m`; }
    if (h < 24) { return `${Math.round(h)}h`; }
    return `${Math.round(h / 24)}d`;
  }

  private hoursSince(iso: string): number {
    return (Date.now() - new Date(iso).getTime()) / 3_600_000;
  }

  statusClass(s: string): string {
    switch (s) {
      case 'PENDING': return 'pending';
      case 'REVIEWING': return 'review';
      case 'RESOLVED': return 'resolved';
      default: return 'dismissed';
    }
  }
}
