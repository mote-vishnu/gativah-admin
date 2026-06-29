import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { ModerationApi } from '../../core/moderation.api';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ModerationActionRow, Page } from '../../core/models';

@Component({
  selector: 'app-moderation-history',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, PageHeaderComponent, TableComponent, PaginatorComponent],
  template: `
    <ui-page-header icon="scroll-text" title="Moderation history" subtitle="Every moderation action taken" tint="cyan" [count]="page()?.totalElements ?? null" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No actions recorded.">
      @for (a of page()?.content ?? []; track a.id) {
        <tr>
          <td class="muted">{{ a.createdAt | date: 'MMM d, y, HH:mm' }}</td>
          <td><span class="pill" [class]="actionClass(a.action)">{{ a.action | titlecase }}</span></td>
          <td>{{ a.targetType | titlecase }} #{{ a.targetId }}</td>
          <td>{{ a.reportId ? 'Report #' + a.reportId : '—' }}</td>
          <td class="muted reason">{{ a.reason || '—' }}</td>
          <td>{{ dir.name(a.adminUserId) }}</td>
        </tr>
      }
    </ui-table>

    <ui-paginator [pageIndex]="pageIndex()" [totalPages]="page()?.totalPages ?? 0"
                  [totalElements]="page()?.totalElements ?? 0" unit="action" (pageChange)="goTo($event)" />
  `,
  styles: `
    .mono { font-family: var(--mono); font-size: 11px; }
    .reason { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class ModerationHistoryComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  readonly dir = inject(AdminDirectoryService);

  readonly columns: TableColumn[] = [
    { label: 'When' }, { label: 'Action' }, { label: 'Target' }, { label: 'Report' }, { label: 'Reason' }, { label: 'By' },
  ];
  readonly page = signal<Page<ModerationActionRow> | null>(null);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.dir.load();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.history(this.pageIndex(), 20).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load moderation history.'); this.loading.set(false); },
    });
  }

  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  actionClass(a: string): string {
    switch (a) {
      case 'BAN': case 'TAKEDOWN': return 'banned';
      case 'SUSPEND': return 'pending';
      case 'WARN': return 'review';
      case 'DISMISS': return 'dismissed';
      default: return 'resolved';
    }
  }
}
