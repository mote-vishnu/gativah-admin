import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { ContentApi } from '../../core/content.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ContentRow, Page, StoryRow } from '../../core/models';

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
    <ui-page-header [icon]="view() === 'stories' ? 'image' : 'message-square'"
                    [title]="view() === 'stories' ? 'Stories' : 'Posts & comments'"
                    [subtitle]="view() === 'stories' ? 'Ephemeral stories · view & reaction counts' : 'Posts & comments · proactive moderation'"
                    tint="violet" [count]="headerCount()" />

    <div class="toolbar">
      <div class="search"><ui-input placeholder="Search content or author…" [(ngModel)]="q" (enter)="search()" /></div>
      @if (view() === 'content') {
        <div class="filt"><ui-multiselect placeholder="All types" [options]="typeOptions" [(ngModel)]="typeSel" (ngModelChange)="applyFilter()" /></div>
        <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
      }
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    @switch (view()) {
      @case ('content') {
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
        <ui-paginator [pageIndex]="pageIndex()" [totalPages]="page()?.totalPages ?? 0" [totalElements]="page()?.totalElements ?? 0" unit="item" (pageChange)="goTo($event)" />
      }
      @case ('stories') {
        <ui-table [columns]="storyCols()" [loading]="loading()" [empty]="(stories()?.content?.length ?? 0) === 0" emptyText="No stories found.">
          @for (s of stories()?.content ?? []; track s.id) {
            <tr>
              <td>{{ s.authorUsername ? '@' + s.authorUsername : '#' + s.authorUserId }}</td>
              <td>{{ s.kind | titlecase }}</td>
              <td class="snip">{{ s.snippet || '—' }}</td>
              <td><span class="count">{{ s.viewCount }}</span></td>
              <td><span class="count">{{ s.reactionCount }}</span></td>
              <td><span class="pill" [class]="storyClass(s)">{{ storyStatus(s) }}</span></td>
              <td class="muted">{{ s.createdAt | date: 'MMM d, HH:mm' }}</td>
              @if (canEdit()) {
                <td class="rowact">
                  @if (!s.removed) {
                    <button class="btn tiny danger" (click)="takedownStory(s)" [disabled]="busy()"><lucide-icon name="flag" [size]="13" /> Take down</button>
                  } @else { <span class="muted">—</span> }
                </td>
              }
            </tr>
          }
        </ui-table>
        <ui-paginator [pageIndex]="storyPage()" [totalPages]="stories()?.totalPages ?? 0" [totalElements]="stories()?.totalElements ?? 0" unit="story" (pageChange)="storyGoTo($event)" />
      }
    }
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 300px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .snip { max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
    .count { font-weight: 700; }
    .rowact { text-align: right; white-space: nowrap; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; }
  `,
})
export class ContentListComponent implements OnInit {
  private readonly api = inject(ContentApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly typeOptions = TYPE_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;
  typeSel: string[] = [];
  statusSel: string[] = [];
  readonly view = signal<'content' | 'stories'>('content');
  readonly pageIndex = signal(0);
  readonly storyPage = signal(0);
  readonly page = signal<Page<ContentRow> | null>(null);
  readonly stories = signal<Page<StoryRow> | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  q = '';

  readonly canEdit = computed(() => this.auth.can('CONTENT:EDIT'));
  readonly headerCount = computed(() =>
    (this.view() === 'content' ? this.page()?.totalElements : this.stories()?.totalElements) ?? null);
  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Type' }, { label: 'Author' }, { label: 'Content' }, { label: 'Status' }, { label: 'Created' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });
  readonly storyCols = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Author' }, { label: 'Kind' }, { label: 'Preview' }, { label: 'Views' }, { label: 'Reactions' }, { label: 'Status' }, { label: 'Created' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.view.set((this.route.snapshot.data['view'] as 'content' | 'stories') ?? 'content');
    if (this.view() === 'stories') { this.loadStories(); } else { this.load(); }
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

  private loadStories(): void {
    this.loading.set(true);
    this.api.stories({ q: this.q.trim() || null, page: this.storyPage(), size: 20 }).subscribe({
      next: (p) => { this.stories.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load stories.'); this.loading.set(false); },
    });
  }

  search(): void {
    if (this.view() === 'stories') { this.storyPage.set(0); this.loadStories(); } else { this.pageIndex.set(0); this.load(); }
  }

  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }
  storyGoTo(i: number): void { this.storyPage.set(i); this.loadStories(); }

  storyStatus(s: StoryRow): string {
    if (s.removed) { return 'Removed'; }
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) { return 'Expired'; }
    return 'Active';
  }

  storyClass(s: StoryRow): string {
    const st = this.storyStatus(s);
    return st === 'Removed' ? 'banned' : st === 'Expired' ? 'dismissed' : 'active';
  }

  async takedownStory(s: StoryRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: 'Take down this story?',
      message: 'The story is removed and the action is written to the audit log.',
      confirmLabel: 'Take down',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'e.g. nudity / harassment', multiline: true },
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.takedown('STORY', s.id, { reason: res.value ?? '' }).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Story removed.'); this.loadStories(); },
      error: () => { this.busy.set(false); this.toast.error('Takedown failed — check the admin API / internal hook.'); },
    });
  }

  async takedown(r: ContentRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Take down this ${r.type.toLowerCase()}?`,
      message: 'The content is removed and the action is written to the audit log.',
      confirmLabel: 'Take down',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'e.g. spam / policy violation', multiline: true },
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.takedown(r.type, r.id, { reason: res.value ?? '' }).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Content removed.'); this.load(); },
      error: () => { this.busy.set(false); this.toast.error('Takedown failed — check the admin API / internal hook.'); },
    });
  }
}
