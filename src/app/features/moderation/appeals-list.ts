import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SelectComponent, SelectOption } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { AuthService } from '../../core/auth.service';
import { ModerationApi } from '../../core/moderation.api';
import { AppealRow, Page } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'GRANTED', label: 'Granted' },
  { value: 'DENIED', label: 'Denied' },
];

@Component({
  selector: 'app-appeals-list',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, SelectComponent, PageHeaderComponent, TableComponent, PaginatorComponent],
  template: `
    <ui-page-header icon="scale" title="Appeals" subtitle="User appeals against moderation actions" tint="violet" [count]="page()?.totalElements ?? null" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    <div class="toolbar">
      <div class="filt"><ui-select [options]="statusOptions" [(ngModel)]="status" (ngModelChange)="reload()" /></div>
    </div>

    <ui-table [columns]="columns()" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No appeals.">
      @for (a of page()?.content ?? []; track a.id) {
        <tr>
          <td class="mono">#{{ a.id }}</td>
          <td>
            @if (a.subjectUsername) { <a [routerLink]="['/users', a.subjectUserId]">{{ '@' + a.subjectUsername }}</a> }
            @else { #{{ a.subjectUserId }} }
          </td>
          <td>
            @if (a.originalAction) { <span class="pill" [class]="actionClass(a.originalAction)">{{ a.originalAction | titlecase }}</span> }
            @else if (a.relatedReportId) { Report #{{ a.relatedReportId }} }
            @else { <span class="muted">—</span> }
          </td>
          <td class="msg"><span class="muted">{{ a.message }}</span></td>
          <td><span class="pill" [class]="statusClass(a.status)">{{ a.status | titlecase }}</span></td>
          <td class="muted">{{ a.createdAt | date: 'MMM d, y' }}</td>
          @if (canEdit()) {
            <td class="rowact">
              @if (a.status === 'OPEN') {
                <button class="btn tiny ok-btn" (click)="resolve(a, true)" [disabled]="busy()">Grant</button>
                <button class="btn tiny danger" (click)="resolve(a, false)" [disabled]="busy()">Deny</button>
              } @else { <span class="muted">—</span> }
            </td>
          }
        </tr>
      }
    </ui-table>

    <ui-paginator [pageIndex]="pageIndex()" [totalPages]="page()?.totalPages ?? 0"
                  [totalElements]="page()?.totalElements ?? 0" unit="appeal" (pageChange)="goTo($event)" />
  `,
  styles: `
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .toolbar { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .mono { font-family: var(--mono); font-size: 11px; }
    .msg { max-width: 360px; } .msg .muted { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rowact { text-align: right; white-space: nowrap; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; margin-left: 6px; }
    .btn.ok-btn:hover { border-color: var(--green); color: var(--green); }
    .btn.danger { color: var(--rose); } .btn.danger:hover { border-color: var(--rose); }
  `,
})
export class AppealsListComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly statusOptions = STATUS_OPTIONS;
  status = '';
  readonly page = signal<Page<AppealRow> | null>(null);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('APPEALS:EDIT'));
  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Appeal' }, { label: 'User' }, { label: 'Original action' }, { label: 'Message' }, { label: 'Status' }, { label: 'Submitted' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.appeals(this.status || null, this.pageIndex(), 20).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load appeals (needs APPEALS:VIEW).'); this.loading.set(false); },
    });
  }

  reload(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  async resolve(a: AppealRow, grant: boolean): Promise<void> {
    const res = await this.confirm.confirm({
      title: `${grant ? 'Grant' : 'Deny'} appeal #${a.id}?`,
      message: grant ? 'Granting reinstates the affected user.' : 'The original action stands.',
      confirmLabel: grant ? 'Grant' : 'Deny',
      tone: grant ? 'default' : 'danger',
      input: { label: 'Note (optional)', placeholder: 'Rationale recorded with the decision', multiline: true },
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.resolveAppeal(a.id, { grant, note: res.value || undefined }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Appeal #${a.id} ${grant ? 'granted' : 'denied'}.`);
        this.load();
      },
      error: () => { this.busy.set(false); this.toast.error('Could not resolve the appeal.'); },
    });
  }

  statusClass(s: string): string {
    if (s === 'GRANTED') { return 'resolved'; }
    if (s === 'DENIED') { return 'dismissed'; }
    return 'pending';
  }

  actionClass(a: string): string {
    switch (a) {
      case 'BAN': case 'TAKEDOWN': return 'banned';
      case 'SUSPEND': return 'pending';
      case 'WARN': return 'review';
      case 'DISMISS': return 'dismissed';
      default: return 'reason';
    }
  }
}
