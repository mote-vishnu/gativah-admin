import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../shared/icon';
import { InputComponent, SelectComponent, SelectOption, DateRange, DateRangeComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { AuditApi } from '../../core/admin.api';
import { ExportService } from '../../core/export.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuditEntryRow, Page } from '../../core/models';

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: '', label: 'All actions' },
  { value: 'REPORT_', label: 'Moderation' },
  { value: 'APPEAL_', label: 'Appeals' },
  { value: 'CONTENT_', label: 'Content' },
  { value: 'USER_', label: 'Users' },
  { value: 'ENTITLEMENT_', label: 'Billing' },
  { value: 'ROLE_', label: 'Roles' },
  { value: 'STAFF_', label: 'Staff' },
  { value: 'LEGAL_', label: 'Legal' },
];

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, InputComponent, SelectComponent, DateRangeComponent, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="scroll-text" title="Audit Log" subtitle="Every operator action · append-only"
                    tint="cyan" [count]="page()?.totalElements ?? null">
      <button page-actions class="btn" (click)="exportCsv()" [disabled]="(page()?.content?.length ?? 0) === 0">
        <lucide-icon name="download" [size]="15" /> Export
      </button>
    </ui-page-header>

    <div class="toolbar">
      <div class="f"><ui-select [options]="categoryOptions" [(ngModel)]="category" (ngModelChange)="applyFilter()" /></div>
      <div class="f"><ui-select [options]="actorOptions()" [(ngModel)]="actorSel" (ngModelChange)="applyFilter()" /></div>
      <div class="f wide"><ui-input placeholder="Search summary / action…" [(ngModel)]="q" (enter)="applyFilter()" /></div>
      <ui-date-range [(ngModel)]="range" (ngModelChange)="applyFilter()" />
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No audit entries yet.">
      @for (a of page()?.content ?? []; track a.id) {
        <tr>
          <td class="muted">{{ a.createdAt | date: 'MMM d, HH:mm:ss' }}</td>
          <td>{{ dir.name(a.adminUserId) }}</td>
          <td><span class="pill reason">{{ a.action }}</span></td>
          <td class="muted">{{ a.targetType }}{{ a.targetId ? ' #' + a.targetId : '' }}</td>
          <td>{{ a.summary }}</td>
          <td class="mono muted">{{ a.ip || '—' }}</td>
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="entry"
      unitPlural="entries"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .f { width: 180px; max-width: 100%; } .toolbar .f.wide { width: 260px; }
  `,
})
export class AuditComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);
  readonly dir = inject(AdminDirectoryService);

  readonly pageIndex = signal(0);
  readonly page = signal<Page<AuditEntryRow> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly categoryOptions = CATEGORY_OPTIONS;
  category = '';
  actorSel = '';
  q = '';
  range: DateRange = { from: null, to: null };

  readonly actorOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All operators' },
    ...this.dir.entries().sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ value: String(e.id), label: e.name })),
  ]);

  readonly columns: TableColumn[] = [
    { label: 'When' },
    { label: 'Actor' },
    { label: 'Action' },
    { label: 'Target' },
    { label: 'Summary' },
    { label: 'IP' },
  ];

  ngOnInit(): void {
    this.dir.load();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list({
      actorId: this.actorSel ? Number(this.actorSel) : null,
      action: this.category || null,
      q: this.q.trim() || null,
      from: this.range.from,
      to: this.range.to,
      page: this.pageIndex(),
      size: 25,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load the audit log.'); this.loading.set(false); },
    });
  }

  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  exportCsv(): void {
    const rows = (this.page()?.content ?? []).map((a) => ({
      when: a.createdAt, actor: a.adminUserId, action: a.action,
      target: a.targetType + (a.targetId ? ' #' + a.targetId : ''), summary: a.summary, ip: a.ip ?? '',
    }));
    if (!rows.length) { return; }
    this.exporter.download('audit-log', [
      { key: 'when', label: 'When' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' },
      { key: 'target', label: 'Target' }, { key: 'summary', label: 'Summary' }, { key: 'ip', label: 'IP' },
    ], rows);
    this.toast.info(`Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}.`);
  }
}
