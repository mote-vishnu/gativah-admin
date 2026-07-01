import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { PostCardComponent } from '../../shared/post-card/post-card.component';
import { ContentApi } from '../../core/content.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ContentDetail, ContentReportRef, ContentRow, ContentStats, Page, StoryRow } from '../../core/models';

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
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, InputComponent, MultiSelectComponent, IconComponent, TableComponent, PaginatorComponent, PageHeaderComponent, PostCardComponent],
  template: `
    <ui-page-header [icon]="view() === 'stories' ? 'image' : 'message-square'"
                    [title]="view() === 'stories' ? 'Stories' : 'Posts & comments'"
                    [subtitle]="view() === 'stories' ? 'Ephemeral stories · view & reaction counts' : 'Posts & comments · proactive moderation'"
                    tint="violet" [count]="headerCount()" />

    @if (stats(); as st) {
      <div class="row g5" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="message-square" [size]="16" /></span> Posts</div><div class="val c-violet">{{ st.posts }}</div><div class="delta flat">authored</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="message-square" [size]="16" /></span> Comments</div><div class="val c-cyan">{{ st.comments }}</div><div class="delta flat">on posts</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="image" [size]="16" /></span> Stories</div><div class="val c-green">{{ st.stories }}</div><div class="delta flat">live</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="flag" [size]="16" /></span> Flagged</div><div class="val" [class.bad]="st.flagged > 0" [class.c-green]="st.flagged === 0">{{ st.flagged }}</div><div class="delta flat">open reports</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="ban" [size]="16" /></span> Removed</div><div class="val c-amber">{{ st.removed }}</div><div class="delta flat">taken down</div></div>
      </div>
    }

    <div class="toolbar">
      <div class="search"><ui-input placeholder="Search content or author…" [(ngModel)]="q" (enter)="search()" /></div>
      @if (view() === 'content') {
        <div class="filt"><ui-multiselect placeholder="All types" [options]="typeOptions" [(ngModel)]="typeSel" (ngModelChange)="applyFilter()" /></div>
        <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
        <button class="chip" [class.on]="reported()" (click)="toggleReported()"><lucide-icon name="flag" [size]="13" /> Flagged only</button>
      }
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    @switch (view()) {
      @case ('content') {
        <ui-table [columns]="columns()" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No content found.">
          @for (r of page()?.content ?? []; track r.type + '-' + r.id) {
            <tr class="clickable" (click)="openReports(r)">
              <td>
                <span class="pill reason">{{ r.type | titlecase }}</span>
                @if (r.activityType) { <span class="actpill"><lucide-icon [name]="r.activityType === 'CYCLING' ? 'webhook' : 'flag'" [size]="10" /> {{ r.activityType | titlecase }}</span> }
              </td>
              <td>{{ r.authorUsername ? '@' + r.authorUsername : '—' }}</td>
              <td class="snip">{{ plainMentions(r.snippet) || '(no content)' }}</td>
              <td>
                @if (r.openReports > 0) { <span class="tag rose"><lucide-icon name="flag" [size]="11" /> {{ r.openReports }} flagged</span> }
                @else if (r.totalReports > 0) { <span class="tag muted">{{ r.totalReports }} reviewed</span> }
                @else { <span class="muted">—</span> }
              </td>
              <td><span class="pill" [class]="r.removed ? 'banned' : 'active'">{{ r.removed ? 'Removed' : 'Active' }}</span></td>
              <td class="muted">{{ r.createdAt | date: 'MMM d, HH:mm' }}</td>
              @if (canEdit()) {
                <td class="rowact" (click)="$event.stopPropagation()">
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

    @if (selected(); as r) {
      <div class="cmodal-scrim" (click)="closeReports()"></div>
      <div class="cmodal" role="dialog" aria-label="Content detail">
        <button class="cmodal-x" (click)="closeReports()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>

        @if (detailLoading()) {
          <div class="empty" style="padding:60px">Loading…</div>
        } @else if (detail(); as d) {
          <div class="postwrap">
            <!-- feed-style post card -->
            <app-post-card [detail]="d" />

            <!-- moderation options, beside the post -->
            <aside class="optpanel">
              <div class="op-h"><span class="pill reason">{{ d.type | titlecase }} #{{ d.id }}</span></div>

              <section class="dl">
                <div class="r"><span>Author</span><b>@if (d.authorUserId) { <a [routerLink]="['/users', d.authorUserId]">{{ d.authorUsername ? '@' + d.authorUsername : '#' + d.authorUserId }}</a> } @else { — }</b></div>
                <div class="r"><span>Status</span><b><span class="pill" [class]="d.removed ? 'banned' : 'active'">{{ d.removed ? 'Removed' : 'Active' }}</span></b></div>
                @if (d.type === 'POST') {
                  <div class="r"><span>Kind</span><b>{{ d.kind | titlecase }}</b></div>
                  <div class="r"><span>Privacy</span><b>{{ d.privacy | titlecase }}</b></div>
                  <div class="r"><span>Views</span><b>{{ d.viewCount }}</b></div>
                  <div class="r"><span>Comments</span><b>{{ d.commentCount }}</b></div>
                }
                <div class="r"><span>Reactions</span><b>{{ d.reactionTotal }}</b></div>
                <div class="r"><span>Created</span><b>{{ d.createdAt | date: 'MMM d, y' }}</b></div>
              </section>

              @if (d.reactions.length) {
                <div class="rx">
                  @for (rx of d.reactions; track rx.type) { <span class="rxchip">{{ emoji(rx.type) }} {{ rx.count }}</span> }
                </div>
              }

              @if (canEdit() && !d.removed) {
                <button class="btn danger" style="margin-top:14px;width:100%" (click)="takedown(d)" [disabled]="busy()"><lucide-icon name="flag" [size]="14" /> Take down this {{ d.type.toLowerCase() }}</button>
              }

              <h4 class="op-sub">Reports@if (reports().length) { · {{ reports().length }} }</h4>
              @if (reportsLoading()) {
                <div class="empty sm">Loading…</div>
              } @else if (reports().length) {
                @for (rep of reports(); track rep.reportId) {
                  <a class="rep" [routerLink]="['/moderation', rep.reportId]">
                    <span class="dot" [class.open]="isOpen(rep.status)"></span>
                    <div class="grow">
                      <div class="rt"><b>{{ rep.reason }}</b> <span class="pill sm" [class]="repClass(rep.status)">{{ rep.status | titlecase }}</span></div>
                      <div class="sub">by {{ rep.reporterUsername ? '@' + rep.reporterUsername : '#' + rep.reporterUserId }} · {{ rep.createdAt | date: 'MMM d, y' }}</div>
                    </div>
                    <lucide-icon name="chevron-right" [size]="15" />
                  </a>
                }
              } @else {
                <p class="empty sm">No reports filed.</p>
              }
            </aside>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 300px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .snip { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
    .count { font-weight: 700; }
    .rowact { text-align: right; white-space: nowrap; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; }
    .kpi .val.bad { color: var(--rose); } .kpi .val.c-violet { color: var(--violet); } .kpi .val.c-cyan { color: var(--cyan); } .kpi .val.c-green { color: var(--green); } .kpi .val.c-amber { color: var(--amber); }
    .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 600; padding: 9px 14px; border-radius: 999px; cursor: pointer; }
    .chip:hover { color: var(--ink); } .chip.on { border-color: rgba(244,63,94,0.4); background: rgba(244,63,94,0.1); color: var(--rose); }
    .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 2px 8px; }
    .tag.rose { color: var(--rose); background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25); }
    .tag.muted { color: var(--muted-2); background: var(--surface-2); border: 1px solid var(--line); font-weight: 600; }
    tr.clickable { cursor: pointer; } tr.clickable:hover { background: var(--surface-2); }
    .actpill { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; font-size: 10px; font-weight: 700; color: var(--brand); background: var(--brand-soft); border: 1px solid var(--brand-line); border-radius: 999px; padding: 1px 7px; }
    .actpill lucide-icon { color: var(--brand); }

    /* ── content modal: post card + options ── */
    .cmodal-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); z-index: 40; animation: fade .15s ease; }
    .cmodal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 960px; max-width: 94vw; max-height: 90vh; overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow); z-index: 41; padding: 24px; animation: rise .16s var(--ease); }
    @keyframes fade { from { opacity: 0; } } @keyframes rise { from { opacity: 0; transform: translate(-50%, -46%); } }
    .cmodal-x { position: absolute; top: 16px; right: 16px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer; color: var(--muted); z-index: 1; }
    .cmodal-x:hover { color: var(--ink); }
    .postwrap { display: grid; grid-template-columns: 1.6fr 320px; gap: 22px; }
    @media (max-width: 820px) { .postwrap { grid-template-columns: 1fr; } }

    .optpanel { align-self: start; position: sticky; top: 0; }
    .op-h { margin-bottom: 14px; }
    .op-sub { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); margin: 20px 0 10px; }
    .dl { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .dl .r { display: flex; justify-content: space-between; gap: 16px; padding: 9px 13px; font-size: 12.5px; }
    .dl .r:nth-child(odd) { background: var(--surface-2); }
    .dl .r span { color: var(--muted-2); }
    .rx { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
    .rxchip { display: inline-flex; align-items: center; gap: 5px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; font-weight: 600; }
    .rep { display: flex; align-items: center; gap: 10px; padding: 10px 11px; border: 1px solid var(--line); border-radius: 11px; margin-bottom: 8px; transition: 0.12s var(--ease); }
    .rep:hover { border-color: var(--brand-line); background: var(--surface-2); }
    .rep .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted-2); flex-shrink: 0; }
    .rep .dot.open { background: var(--rose); box-shadow: 0 0 0 3px rgba(244,63,94,0.18); }
    .rep .grow { flex: 1; min-width: 0; } .rep .rt { font-size: 12.5px; display: flex; align-items: center; gap: 7px; }
    .rep .sub { font-size: 11px; color: var(--muted-2); margin-top: 3px; }
    .rep lucide-icon { color: var(--muted-2); flex-shrink: 0; }
    .pill.sm { font-size: 9.5px; padding: 1px 7px; }
    .empty { padding: 20px; text-align: center; color: var(--muted-2); font-size: 13px; }
    .empty.sm { padding: 12px; font-size: 12.5px; }
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
  readonly stats = signal<ContentStats | null>(null);
  readonly reported = signal(false);
  readonly selected = signal<ContentRow | null>(null);
  readonly detail = signal<ContentDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly reports = signal<ContentReportRef[]>([]);
  readonly reportsLoading = signal(false);
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
      { label: 'Type' }, { label: 'Author' }, { label: 'Content' }, { label: 'Reports' }, { label: 'Status' }, { label: 'Created' },
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
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    this.api.list({
      type: this.typeSel,
      status: this.statusSel,
      q: this.q.trim() || null,
      reported: this.reported(),
      page: this.pageIndex(),
      size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load content (needs CONTENT:VIEW).'); this.loading.set(false); },
    });
  }

  toggleReported(): void { this.reported.update((v) => !v); this.applyFilter(); }

  openReports(r: ContentRow): void {
    this.selected.set(r);
    this.detail.set(null);
    this.reports.set([]);
    this.detailLoading.set(true);
    this.reportsLoading.set(true);
    this.api.detail(r.type, r.id).subscribe({
      next: (d) => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
    this.api.reports(r.type, r.id).subscribe({
      next: (res) => { this.reports.set(res.reports); this.reportsLoading.set(false); },
      error: () => this.reportsLoading.set(false),
    });
  }

  closeReports(): void { this.selected.set(null); this.detail.set(null); }

  isOpen(status: string): boolean { return status === 'PENDING' || status === 'REVIEWING'; }

  private readonly reactionEmoji: Record<string, string> = {
    LIKE: '👍', LOVE: '❤️', HAHA: '😂', WOW: '😮', CARE: '🤗', SAD: '😢', ANGRY: '😠', CELEBRATE: '🎉', STRONG: '💪',
  };
  emoji(type: string): string {
    return this.reactionEmoji[type] ?? (type.length <= 3 ? type : '•');
  }

  /** Flatten mention tokens to plain `@Name` for the list snippet. */
  plainMentions(text: string | null): string {
    return (text || '').replace(/\{@\}\[([^\]]+)\]\((\d+)\)/g, '@$1');
  }

  repClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'pending';
      case 'REVIEWING': return 'review';
      case 'RESOLVED': return 'resolved';
      default: return 'dismissed';
    }
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

  async takedown(r: { type: string; id: number }): Promise<void> {
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
      next: () => {
        this.busy.set(false); this.toast.success('Content removed.');
        this.closeReports(); this.load();
        this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
      },
      error: () => { this.busy.set(false); this.toast.error('Takedown failed — check the admin API / internal hook.'); },
    });
  }
}
