import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CheckboxComponent, MultiSelectComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, SortState, TableColumn, TableComponent } from '../../shared/table';
import { ModerationApi } from '../../core/moderation.api';
import { AuthService } from '../../core/auth.service';
import { ExportService } from '../../core/export.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { Page, ReportStats, ReportSummary, ResolveAction } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWING', label: 'Reviewing' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];
const REASON_OPTIONS: SelectOption[] = [
  { value: '', label: 'All reasons' },
  { value: 'Harassment', label: 'Harassment' },
  { value: 'Spam', label: 'Spam' },
  { value: 'Nudity', label: 'Nudity' },
  { value: 'Misinformation', label: 'Misinformation' },
  { value: 'Illegal', label: 'Illegal' },
];
const TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All content' },
  { value: 'POST', label: 'Posts' },
  { value: 'COMMENT', label: 'Comments' },
];
const OVERDUE_HOURS = 24;

@Component({
  selector: 'app-moderation-list',
  standalone: true,
  template: `
    <ui-page-header icon="flag" title="Grievance queue" subtitle="Triage open content reports"
                    tint="rose" [count]="page()?.totalElements ?? null">
      <button page-actions class="btn" (click)="exportCsv()" [disabled]="(page()?.content?.length ?? 0) === 0">
        <lucide-icon name="download" [size]="15" /> Export
      </button>
    </ui-page-header>

    @if (stats(); as st) {
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="flag" [size]="16" /></span> Open</div><div class="val c-rose">{{ st.open }}</div><div class="delta flat">{{ st.pending }} pending · {{ st.reviewing }} reviewing</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="triangle-alert" [size]="16" /></span> SLA breaches</div><div class="val c-amber" [class.bad]="st.slaBreaches > 0">{{ st.slaBreaches }}</div><div class="delta flat">past triage target</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="check" [size]="16" /></span> Resolved · 24h</div><div class="val c-green">{{ st.resolved24h }}</div><div class="delta flat">last day</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="users-round" [size]="16" /></span> Repeat offenders</div><div class="val c-violet">{{ st.repeatOffenders }}</div><div class="delta flat">≥3 open reports</div></div>
      </div>
    }

    <div class="filterbar">
      <div class="f wide"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
      <div class="f"><ui-select [options]="reasonOptions" [(ngModel)]="reasonSel" (ngModelChange)="applyFilter()" /></div>
      <div class="f"><ui-select [options]="typeOptions" [(ngModel)]="typeSel" (ngModelChange)="applyFilter()" /></div>
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

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

    <ui-table [columns]="columns()" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No reports."
              [sort]="sort()" (sortChange)="onSort($event)">
      @for (r of page()?.content ?? []; track r.id) {
        <tr class="clickable" (click)="open(r)">
          @if (canEdit()) {
            <td class="pick" (click)="$event.stopPropagation()">
              <ui-checkbox [checked]="selected().has(r.id)" (checkedChange)="toggle(r.id, $event)" />
            </td>
          }
          <td><span class="sev" [class]="sevClass(r.maxSeverity)" [title]="sevTitle(r.maxSeverity)"></span></td>
          <td>
            <div class="cnt"><b>{{ r.contentType | titlecase }}</b> · {{ snippet(r) }}</div>
            @if (r.reporterCount > 1) { <span class="sub">⚑ reported by {{ r.reporterCount }}</span> }
          </td>
          <td>
            {{ r.authorUsername ? '@' + r.authorUsername : '—' }}
            @if (r.openReportsOnAuthor > 1) { <span class="repeat" title="open reports on this author">{{ r.openReportsOnAuthor }} open</span> }
          </td>
          <td>{{ r.reporterUsername ? '@' + r.reporterUsername : '—' }}</td>
          <td><span class="pill reason">{{ r.reason }}</span></td>
          <td>
            @if (isOpen(r.status)) {
              <span class="pill" [class]="slaTone(r)">{{ slaLabel(r) }}</span>
              <div class="age">{{ r.createdAt | date: 'MMM d, HH:mm' }}</div>
            } @else { <span class="muted">—</span> }
          </td>
          <td><span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span></td>
          <td>{{ assigneeLabel(r) }}</td>
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
    .filterbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .filterbar .f { width: 190px; max-width: 100%; }
    .filterbar .f.wide { width: 240px; }
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .bulkbar { display: flex; align-items: center; gap: 9px; padding: 10px 14px; margin-bottom: 14px; border: 1px solid var(--brand-line); background: var(--brand-soft); border-radius: var(--r-sm); }
    .bulkbar .cnt { font-size: 13px; font-weight: 600; color: var(--brand); }
    .bulkbar .spacer { flex: 1; }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .pick { width: 1%; white-space: nowrap; }
    .age { font-size: 10px; color: var(--muted-2); margin-top: 3px; }
    .cnt { font-size: 13px; }
    .sub { display: inline-block; font-size: 10.5px; color: var(--amber); margin-top: 3px; }
    .repeat { font-size: 9.5px; font-weight: 700; color: var(--rose); background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25); border-radius: 999px; padding: 1px 7px; margin-left: 7px; }
    .sev { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .sev.hi { background: var(--rose); box-shadow: 0 0 0 3px rgba(244,63,94,0.18); }
    .sev.md { background: var(--amber); box-shadow: 0 0 0 3px rgba(251,191,36,0.18); }
    .sev.lo { background: var(--green); }
    .sev.none { background: var(--surface-3); }
    .kpi .val.bad { color: var(--rose); }
  `,
  imports: [FormsModule, DatePipe, TitleCasePipe, TableComponent, PaginatorComponent, CheckboxComponent, IconComponent, MultiSelectComponent, SelectComponent, PageHeaderComponent],
})
export class ModerationListComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly exporter = inject(ExportService);
  private readonly dir = inject(AdminDirectoryService);

  readonly statusOptions = STATUS_OPTIONS;
  readonly reasonOptions = REASON_OPTIONS;
  readonly typeOptions = TYPE_OPTIONS;
  statusSel: string[] = ['PENDING'];
  reasonSel = '';
  typeSel = '';
  readonly sort = signal<SortState | null>(null);
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ReportSummary> | null>(null);
  readonly stats = signal<ReportStats | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly selected = signal<Set<number>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);
  readonly canEdit = computed(() => this.auth.can('GRIEVANCES:EDIT'));

  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: '', width: '1%' },
      { label: 'Reported content', sortKey: 'contentType' },
      { label: 'Author' },
      { label: 'Reporter' },
      { label: 'Reason', sortKey: 'reason' },
      { label: 'SLA', sortKey: 'createdAt' },
      { label: 'Status', sortKey: 'status' },
      { label: 'Assignee' },
    ];
    return this.canEdit() ? [{ label: '', width: '1%' }, ...cols] : cols;
  });

  ngOnInit(): void {
    this.dir.load();
    this.loadStats();
    this.load();
  }

  private loadStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    const s = this.sort();
    this.api.reports({
      status: this.statusSel,
      reason: this.reasonSel || null,
      contentType: this.typeSel || null,
      sort: s ? `${s.key},${s.dir}` : null,
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load reports.'); this.loading.set(false); },
    });
  }

  exportCsv(): void {
    const rows = (this.page()?.content ?? []).map((r) => ({
      id: r.id,
      type: r.contentType,
      reason: r.reason,
      status: r.status,
      author: r.authorUsername ?? '',
      reporter: r.reporterUsername ?? '',
      assignee: r.assigneeAdminId ?? '',
      createdAt: r.createdAt,
    }));
    if (!rows.length) { return; }
    this.exporter.download('grievances', [
      { key: 'id', label: 'Report' },
      { key: 'type', label: 'Type' },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status' },
      { key: 'author', label: 'Author' },
      { key: 'reporter', label: 'Reporter' },
      { key: 'assignee', label: 'Assignee' },
      { key: 'createdAt', label: 'Reported at' },
    ], rows);
    this.toast.info(`Exported ${rows.length} report(s).`);
  }

  applyFilter(): void {
    this.pageIndex.set(0);
    this.clear();
    this.load();
  }

  goTo(i: number): void { this.pageIndex.set(i); this.clear(); this.load(); }
  onSort(s: SortState): void { this.sort.set(s); this.pageIndex.set(0); this.clear(); this.load(); }

  toggle(id: number, on: boolean): void {
    const next = new Set(this.selected());
    if (on) { next.add(id); } else { next.delete(id); }
    this.selected.set(next);
  }

  clear(): void { this.selected.set(new Set()); }

  async bulk(action: ResolveAction): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length) { return; }
    const destructive = action === 'TAKEDOWN' || action === 'BAN' || action === 'SUSPEND';
    const res = await this.confirm.confirm({
      title: `${this.actionLabel(action)} ${ids.length} report(s)?`,
      message: 'This runs the action on each selected report and is written to the audit log.',
      confirmLabel: this.actionLabel(action),
      tone: destructive ? 'danger' : 'default',
      input: { label: 'Reason (optional)', placeholder: 'Recorded with each action' },
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.bulkResolve({ ids, action, reason: res.value || undefined }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.clear();
        this.toast.success(`${r.resolved} resolved${r.failed ? `, ${r.failed} failed` : ''}.`);
        this.load();
        this.loadStats();
      },
      error: () => { this.busy.set(false); this.toast.error('Bulk action failed.'); },
    });
  }

  private actionLabel(a: ResolveAction): string {
    switch (a) {
      case 'TAKEDOWN': return 'Take down';
      case 'DISMISS': return 'Dismiss';
      case 'BAN': return 'Ban author';
      case 'SUSPEND': return 'Suspend author';
      case 'WARN': return 'Warn author';
      default: return 'Resolve';
    }
  }

  assignMe(): void {
    const ids = [...this.selected()];
    if (!ids.length) { return; }
    const me = this.auth.me()?.id ?? null;
    this.busy.set(true);
    this.api.bulkAssign({ ids, adminId: me }).subscribe({
      next: () => {
        this.busy.set(false);
        this.clear();
        this.toast.success(`${ids.length} report(s) assigned to you.`);
        this.load();
      },
      error: () => { this.busy.set(false); this.toast.error('Assign failed.'); },
    });
  }

  assigneeLabel(r: ReportSummary): string {
    if (r.assigneeAdminId == null) { return '—'; }
    return r.assigneeAdminId === this.auth.me()?.id ? 'you' : this.dir.name(r.assigneeAdminId);
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

  isOpen(s: string): boolean {
    return s === 'PENDING' || s === 'REVIEWING';
  }

  /** Triage target (hours) by reason — drives the SLA countdown / breach state. */
  private slaHours(reason: string): number {
    switch (reason) {
      case 'Illegal': return 2;
      case 'Harassment': case 'Nudity': return 4;
      case 'Misinformation': return 12;
      default: return 24; // Spam etc.
    }
  }

  private hoursLeft(r: ReportSummary): number {
    return this.slaHours(r.reason) - this.hoursSince(r.createdAt);
  }

  slaLabel(r: ReportSummary): string {
    const left = this.hoursLeft(r);
    if (left <= 0) { return `Breached ${this.age(r.createdAt)}`; }
    if (left < 1) { return `${Math.max(1, Math.round(left * 60))}m left`; }
    return `${Math.round(left)}h left`;
  }

  slaTone(r: ReportSummary): string {
    const left = this.hoursLeft(r);
    if (left <= 0) { return 'banned'; }
    if (left <= this.slaHours(r.reason) * 0.25) { return 'pending'; }
    return 'resolved';
  }

  sevClass(sev: string | null): string {
    switch (sev) {
      case 'HIGH': return 'hi';
      case 'MED': return 'md';
      case 'LOW': return 'lo';
      default: return 'none';
    }
  }

  sevTitle(sev: string | null): string {
    return sev ? `${sev[0] + sev.slice(1).toLowerCase()} auto-flag severity` : 'No auto-flag signals';
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
