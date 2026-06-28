import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { AuditApi } from '../../core/admin.api';
import { AuditEntryRow, Page } from '../../core/models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [DatePipe, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="scroll-text" title="Audit Log" subtitle="Every operator action · append-only"
                    tint="cyan" [count]="page()?.totalElements ?? null" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No audit entries yet.">
      @for (a of page()?.content ?? []; track a.id) {
        <tr>
          <td class="muted">{{ a.createdAt | date: 'MMM d, HH:mm:ss' }}</td>
          <td>#{{ a.adminUserId }}</td>
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
  `,
})
export class AuditComponent implements OnInit {
  private readonly api = inject(AuditApi);

  readonly pageIndex = signal(0);
  readonly page = signal<Page<AuditEntryRow> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { label: 'When' },
    { label: 'Actor' },
    { label: 'Action' },
    { label: 'Target' },
    { label: 'Summary' },
    { label: 'IP' },
  ];

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(this.pageIndex(), 25).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load the audit log.'); this.loading.set(false); },
    });
  }

  goTo(i: number): void { this.pageIndex.set(i); this.load(); }
}
