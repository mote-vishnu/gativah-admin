import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { ContentApi } from '../../core/content.api';
import { AuthService } from '../../core/auth.service';
import { ContentRow, Page } from '../../core/models';

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'POST', label: 'Post' },
  { value: 'COMMENT', label: 'Comment' },
];
const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REMOVED', label: 'Removed' },
];

@Component({
  selector: 'app-content-list',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, InputComponent, MultiSelectComponent, IconComponent, TableComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="message-square" title="Content" subtitle="Posts & comments · proactive moderation"
                    tint="violet" [count]="page()?.totalElements ?? null" />

    <div class="toolbar">
      <div class="search"><ui-input placeholder="Search content or author…" [(ngModel)]="q" (enter)="search()" /></div>
      <div class="filt"><ui-multiselect placeholder="All types" [options]="typeOptions" [(ngModel)]="typeSel" (ngModelChange)="applyFilter()" /></div>
      <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    <ui-table [columns]="columns()" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No content found.">
      @for (r of page()?.content ?? []; track r.type + '-' + r.id) {
        <tr>
          <td><span class="pill reason">{{ r.type | titlecase }}</span></td>
          <td>{{ r.authorUsername ? '@' + r.authorUsername : '—' }}</td>
          <td class="snip">{{ r.snippet || '(no content)' }}</td>
          <td><span class="pill" [class]="r.removed ? 'banned' : 'active'">{{ r.removed ? 'Removed' : 'Active' }}</span></td>
          <td class="muted">{{ r.createdAt | date: 'MMM d, HH:mm' }}</td>
          @if (canEdit()) {
            <td class="rowact">
              @if (!r.removed) {
                <button class="btn tiny danger" (click)="takedown(r)" [disabled]="busy()"><lucide-icon name="flag" [size]="13" /> Take down</button>
              } @else { <span class="muted">—</span> }
            </td>
          }
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="item"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 300px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .snip { max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
    .rowact { text-align: right; white-space: nowrap; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; }
  `,
})
export class ContentListComponent implements OnInit {
  private readonly api = inject(ContentApi);
  private readonly auth = inject(AuthService);

  readonly typeOptions = TYPE_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;
  typeSel: string[] = [];
  statusSel: string[] = [];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ContentRow> | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  q = '';

  readonly canEdit = computed(() => this.auth.can('CONTENT:EDIT'));
  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Type' }, { label: 'Author' }, { label: 'Content' }, { label: 'Status' }, { label: 'Created' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list({
      type: this.typeSel,
      status: this.statusSel,
      q: this.q.trim() || null,
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load content (needs CONTENT:VIEW).'); this.loading.set(false); },
    });
  }

  search(): void { this.pageIndex.set(0); this.load(); }
  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  takedown(r: ContentRow): void {
    const reason = prompt(`Take down this ${r.type.toLowerCase()}? Optionally add a reason:`, '');
    if (reason === null) { return; }
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.takedown(r.type, r.id, { reason }).subscribe({
      next: () => { this.busy.set(false); this.message.set('Content removed.'); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Takedown failed — check the admin API / internal hook.'); },
    });
  }
}
