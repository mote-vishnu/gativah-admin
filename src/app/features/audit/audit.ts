import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { InputComponent, SelectComponent, SelectOption, DateRange, DateRangeComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent } from '../../shared/table';
import { AuditApi } from '../../core/admin.api';
import { ExportService } from '../../core/export.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AuditEntryRow, AuditStats, Page } from '../../core/models';

interface Category { v: string; label: string; }
const CATEGORIES: Category[] = [
  { v: '', label: 'All actions' },
  { v: 'MODERATION', label: 'Moderation' },
  { v: 'FINANCE', label: 'Finance' },
  { v: 'STAFF', label: 'Staff' },
  { v: 'AUTH', label: 'Auth' },
  { v: 'LEGAL', label: 'Legal' },
];

interface ActionMeta { icon: string; tint: string; }

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, IconComponent, InputComponent, SelectComponent, DateRangeComponent, PaginatorComponent, PageHeaderComponent],
  template: `
    <ui-page-header eyebrow="Platform" icon="scroll-text" title="Audit Log" subtitle="Every operator action · append-only"
                    tint="cyan" [count]="stats()?.total ?? (page()?.totalElements ?? null)">
      <button page-actions class="btn" (click)="exportCsv()" [disabled]="(page()?.content?.length ?? 0) === 0">
        <lucide-icon name="download" [size]="15" /> Export
      </button>
    </ui-page-header>

    @if (stats(); as s) {
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="scroll-text" [size]="16" /></span> Total entries</div><div class="val c-cyan">{{ s.total }}</div><div class="delta flat">append-only</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="clock" [size]="16" /></span> Today</div><div class="val c-green">{{ s.today }}</div><div class="delta flat">since midnight</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="calendar" [size]="16" /></span> Last 7 days</div><div class="val c-violet">{{ s.last7d }}</div><div class="delta flat">rolling week</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="users" [size]="16" /></span> Operators</div><div class="val c-orange">{{ s.operators }}</div><div class="delta flat">distinct actors</div></div>
      </div>
    }

    <div class="chips">
      @for (c of categories; track c.v) {
        <button class="chip" [class.on]="category === c.v" (click)="setCategory(c.v)">{{ c.label }}</button>
      }
    </div>

    <div class="toolbar">
      <div class="f"><ui-select [options]="actorOptions()" [(ngModel)]="actorSel" (ngModelChange)="applyFilter()" /></div>
      <div class="f wide"><ui-input placeholder="Search summary / action…" [(ngModel)]="q" (enter)="applyFilter()" /></div>
      <ui-date-range [(ngModel)]="range" (ngModelChange)="applyFilter()" />
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="card feed">
      <div class="card-h"><h3>Operator activity</h3><span class="hint">append-only · immutable · {{ stats()?.total ?? page()?.totalElements ?? 0 }} entries</span></div>
      @if (loading()) {
        <div class="empty">Loading…</div>
      } @else if ((page()?.content?.length ?? 0) === 0) {
        <div class="empty">No audit entries match these filters.</div>
      } @else {
        @for (a of page()!.content; track a.id) {
          <button class="audit-ln" (click)="open(a)">
            <span class="t">{{ a.createdAt | date: 'HH:mm:ss' }}<small>{{ a.createdAt | date: 'MMM d' }}</small></span>
            <span class="ic tint-{{ meta(a.action).tint }}"><lucide-icon [name]="meta(a.action).icon" [size]="15" /></span>
            <div class="bd">
              <div class="line"><b>{{ dir.name(a.adminUserId) }}</b> <span class="act">{{ prettyAction(a.action) }}</span>@if (a.summary) { <span class="sm">— {{ a.summary }}</span> }</div>
              <div class="sub">{{ targetText(a) }}@if (a.ip) { · {{ a.ip }} }</div>
            </div>
            <lucide-icon class="chev" name="chevron-right" [size]="15" />
          </button>
        }
      }
    </div>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="entry"
      unitPlural="entries"
      (pageChange)="goTo($event)"
    />

    @if (selected(); as a) {
      <div class="drawer-scrim" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-label="Audit entry">
        <header class="drawer-h">
          <div>
            <span class="ic tint-{{ meta(a.action).tint }}"><lucide-icon [name]="meta(a.action).icon" [size]="18" /></span>
            <h2>{{ prettyAction(a.action) }}</h2>
          </div>
          <button class="iconbtn" (click)="close()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>
        <section class="dl">
          <div class="r"><span>When</span><b>{{ a.createdAt | date: 'MMM d, y · HH:mm:ss' }}</b></div>
          <div class="r"><span>Operator</span><b>{{ dir.name(a.adminUserId) }} <small class="muted">#{{ a.adminUserId }}</small></b></div>
          <div class="r"><span>Action</span><b class="mono">{{ a.action }}</b></div>
          <div class="r"><span>Target</span><b>
            @if (a.targetType === 'USER' && a.targetId) { <a [routerLink]="['/users', a.targetId]">User #{{ a.targetId }}</a> }
            @else { {{ targetText(a) }} }
          </b></div>
          <div class="r"><span>IP</span><b class="mono">{{ a.ip || '—' }}</b></div>
          <div class="r"><span>Entry</span><b class="mono">#{{ a.id }}</b></div>
        </section>
        @if (a.summary) {
          <h4 class="drawer-sub">Summary</h4>
          <p class="summary">{{ a.summary }}</p>
        }
        <p class="muted" style="margin-top:18px;font-size:12px">This entry is part of the append-only, immutable operator audit trail.</p>
      </aside>
    }
  `,
  styles: `
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .chip { border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: 0.15s var(--ease); }
    .chip:hover { color: var(--ink); }
    .chip.on { border-color: var(--brand-line); background: var(--brand-soft); color: var(--brand); }
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .f { width: 190px; max-width: 100%; } .toolbar .f.wide { width: 260px; }
    .kpi .val.c-cyan { color: var(--cyan); } .kpi .val.c-green { color: var(--green); } .kpi .val.c-violet { color: var(--violet); } .kpi .val.c-orange { color: var(--brand); }

    .feed { padding: 8px 22px; }
    .audit-ln { display: flex; gap: 15px; align-items: flex-start; width: 100%; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--line-soft); padding: 14px 4px; cursor: pointer; font: inherit; transition: 0.12s var(--ease); }
    .audit-ln:last-child { border-bottom: 0; }
    .audit-ln:hover { background: var(--surface-2); }
    .audit-ln .t { font-family: var(--mono); font-size: 11px; color: var(--muted-2); width: 66px; flex-shrink: 0; padding-top: 8px; }
    .audit-ln .t small { display: block; opacity: 0.75; margin-top: 2px; }
    .audit-ln .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; box-shadow: var(--shadow-sm); }
    .audit-ln .bd { flex: 1; min-width: 0; padding-top: 4px; }
    .audit-ln .line { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
    .audit-ln .line b { color: var(--ink); font-weight: 600; }
    .audit-ln .act { color: var(--muted); }
    .audit-ln .sm { color: var(--ink-2); }
    .audit-ln .sub { color: var(--muted-2); font-size: 11.5px; margin-top: 3px; font-family: var(--mono); }
    .audit-ln .chev { color: var(--muted-2); flex-shrink: 0; align-self: center; opacity: 0; transition: 0.12s var(--ease); }
    .audit-ln:hover .chev { opacity: 1; }
    .empty { padding: 40px; text-align: center; color: var(--muted-2); font-size: 13px; }

    .drawer-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; animation: fade .15s ease; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 92vw; background: var(--surface); border-left: 1px solid var(--line); z-index: 41; overflow-y: auto; padding: 22px; box-shadow: -12px 0 32px rgba(0,0,0,0.28); animation: slidein .2s ease; }
    @keyframes fade { from { opacity: 0; } } @keyframes slidein { from { transform: translateX(24px); opacity: 0; } }
    .drawer-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .drawer-h > div { display: flex; align-items: center; gap: 12px; }
    .drawer-h .ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; }
    .drawer-h h2 { font-family: var(--sans); font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
    .iconbtn { background: none; border: 1px solid var(--line); border-radius: 9px; width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer; color: var(--muted-1); }
    .iconbtn:hover { background: var(--surface-2); }
    .dl { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .dl .r { display: flex; justify-content: space-between; gap: 16px; padding: 10px 14px; font-size: 13px; }
    .dl .r:nth-child(odd) { background: var(--surface-2); }
    .dl .r span { color: var(--muted-2); flex-shrink: 0; } .dl .r b { text-align: right; word-break: break-word; }
    .drawer-sub { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); margin: 20px 0 8px; }
    .summary { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; margin: 0; }
  `,
})
export class AuditComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);
  readonly dir = inject(AdminDirectoryService);

  readonly pageIndex = signal(0);
  readonly page = signal<Page<AuditEntryRow> | null>(null);
  readonly stats = signal<AuditStats | null>(null);
  readonly selected = signal<AuditEntryRow | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly categories = CATEGORIES;
  category = '';
  actorSel = '';
  q = '';
  range: DateRange = { from: null, to: null };

  readonly actorOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All operators' },
    ...this.dir.entries().sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ value: String(e.id), label: e.name })),
  ]);

  ngOnInit(): void {
    this.dir.load();
    const qp = this.route.snapshot.queryParamMap;
    this.category = qp.get('category') ?? '';
    this.actorSel = qp.get('actor') ?? '';
    this.q = qp.get('q') ?? '';
    this.range = { from: qp.get('from'), to: qp.get('to') };
    this.pageIndex.set(Math.max(0, Number(qp.get('page') ?? 0)));
    this.load();
    this.loadStats();
  }

  private loadStats(): void {
    this.api.stats(this.actorSel ? Number(this.actorSel) : null)
      .subscribe({ next: (s) => this.stats.set(s), error: () => {} });
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        category: this.category || null,
        actor: this.actorSel || null,
        q: this.q.trim() || null,
        from: this.range.from || null,
        to: this.range.to || null,
        page: this.pageIndex() || null,
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.syncUrl();
    this.api.list({
      actorId: this.actorSel ? Number(this.actorSel) : null,
      category: this.category || null,
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

  setCategory(v: string): void { this.category = v; this.applyFilter(); }
  applyFilter(): void { this.pageIndex.set(0); this.load(); this.loadStats(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

  open(a: AuditEntryRow): void { this.selected.set(a); }
  close(): void { this.selected.set(null); }

  targetText(a: AuditEntryRow): string {
    if (!a.targetType) { return '—'; }
    return a.targetType + (a.targetId ? ' #' + a.targetId : '');
  }

  /** Humanize an action code: strip a leading category prefix, title-case the rest. */
  prettyAction(action: string): string {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Map an action to a tinted icon (mirrors the mockup's action-type glyphs). */
  meta(action: string): ActionMeta {
    const a = (action || '').toUpperCase();
    if (a.includes('REGION')) { return { icon: 'globe', tint: 'rose' }; }
    if (a.includes('BAN')) { return { icon: 'ban', tint: 'rose' }; }
    if (a.includes('SUSPEND')) { return { icon: 'pause', tint: 'amber' }; }
    if (a.includes('REINSTATE') || a.includes('RESTORE') || a.includes('VERIFY') || a.includes('APPROVE')) { return { icon: 'check', tint: 'green' }; }
    if (a.includes('TAKEDOWN') || a.startsWith('CONTENT_') || a.includes('REMOVE')) { return { icon: 'flag', tint: 'amber' }; }
    if (a.includes('DISMISS') || a.includes('RESOLVE')) { return { icon: 'check', tint: 'green' }; }
    if (a.startsWith('ENTITLEMENT_') || a.includes('COMP')) { return { icon: 'dollar-sign', tint: 'green' }; }
    if (a.startsWith('ROLE_')) { return { icon: 'shield-check', tint: 'violet' }; }
    if (a.startsWith('STAFF_')) { return { icon: 'users', tint: 'violet' }; }
    if (a.startsWith('LOGIN') || a.startsWith('MFA') || a.startsWith('AUTH')) { return { icon: 'shield-check', tint: 'cyan' }; }
    if (a.startsWith('LEGAL_')) { return { icon: 'scale', tint: 'amber' }; }
    return { icon: 'scroll-text', tint: 'cyan' };
  }

  exportCsv(): void {
    const rows = (this.page()?.content ?? []).map((a) => ({
      when: a.createdAt, actor: this.dir.name(a.adminUserId), action: a.action,
      target: this.targetText(a), summary: a.summary ?? '', ip: a.ip ?? '',
    }));
    if (!rows.length) { return; }
    this.exporter.download('audit-log', [
      { key: 'when', label: 'When' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' },
      { key: 'target', label: 'Target' }, { key: 'summary', label: 'Summary' }, { key: 'ip', label: 'IP' },
    ], rows);
    this.toast.info(`Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}.`);
  }
}
