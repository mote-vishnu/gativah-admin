import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { DateComponent, InputComponent, MultiSelectComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { LegalApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ExportService } from '../../core/export.service';
import { ToastService } from '../../shared/toast/toast.service';
import {
  CreateLegalRequest, DisclosureRegisterRow, LegalRequestSummary, LegalStats, LegalTaskListRow, Page,
} from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'ACTIONED', label: 'Actioned' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'SUBPOENA', label: 'Subpoena' },
  { value: 'COURT_ORDER', label: 'Court order' },
  { value: 'SEARCH_WARRANT', label: 'Search warrant' },
  { value: 'PRESERVATION', label: 'Preservation hold' },
  { value: 'EMERGENCY_REQUEST', label: 'Emergency request' },
  { value: 'OTHER', label: 'Other' },
];

type Tab = 'requests' | 'worklist' | 'register';

type Draft = {
  reference: string;
  requestType: string;
  requestingAuthority: string;
  subjectUserId: string;
  scope: string;
  dueAt: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  reference: '', requestType: 'SUBPOENA', requestingAuthority: '', subjectUserId: '', scope: '', dueAt: '', notes: '',
};

@Component({
  selector: 'app-legal-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe, RouterLink, IconComponent,
    InputComponent, SelectComponent, MultiSelectComponent, TextareaComponent, DateComponent, TableComponent, PaginatorComponent, PageHeaderComponent,
  ],
  template: `
    <ui-page-header icon="scale" title="Legal & Disclosure" subtitle="Legal requests & the disclosure ledger"
                    tint="amber" [count]="page()?.totalElements ?? null">
      @if (canEdit()) {
        <button page-actions class="btn primary" (click)="toggleCreate()"><lucide-icon name="plus" [size]="15" /> Log request</button>
      }
    </ui-page-header>

    @if (stats(); as st) {
      <div class="row g5" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="scroll-text" [size]="16" /></span> Open</div><div class="val c-cyan">{{ st.openRequests }}</div><div class="delta flat">{{ st.underReview }} under review</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="shield-check" [size]="16" /></span> Pending approval</div><div class="val c-amber" [class.bad]="st.pendingApproval > 0">{{ st.pendingApproval }}</div><div class="delta flat">awaiting sign-off</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="triangle-alert" [size]="16" /></span> Overdue</div><div class="val c-rose" [class.bad]="st.overdue > 0">{{ st.overdue }}</div><div class="delta flat">past due date</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="check" [size]="16" /></span> Actioned · 30d</div><div class="val c-green">{{ st.actioned30d }}</div><div class="delta flat">{{ st.disclosures30d }} disclosures</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="calendar" [size]="16" /></span> Open tasks</div><div class="val c-violet">{{ st.openTasks }}</div><div class="delta flat">across all requests</div></div>
      </div>
    }

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (showCreate()) {
      <div class="card create">
        <div class="card-h"><h3>Log a legal request</h3></div>
        <div class="grid">
          <ui-input label="Reference" hint="Court/case number — the legal-process identifier" [(ngModel)]="draft.reference" />
          <ui-select label="Type" [options]="typeOptions" [(ngModel)]="draft.requestType" />
          <ui-input label="Requesting authority" placeholder="e.g. District Court, FBI…" [(ngModel)]="draft.requestingAuthority" />
          <ui-input label="Subject user ID" type="number" placeholder="optional" [(ngModel)]="draft.subjectUserId" />
          <ui-date label="Due date" [(ngModel)]="draft.dueAt" />
        </div>
        <ui-textarea label="Scope" placeholder="What is being requested…" [rows]="2" [(ngModel)]="draft.scope" />
        <ui-textarea label="Notes" placeholder="Internal notes…" [rows]="2" [(ngModel)]="draft.notes" />
        <div class="actions">
          <button class="btn" (click)="toggleCreate()">Cancel</button>
          <button class="btn primary" (click)="submit()" [disabled]="busy() || !draft.reference.trim() || !draft.requestingAuthority.trim()">Save</button>
        </div>
      </div>
    }

    <div class="subtabs" style="margin-bottom:18px">
      <button [class.on]="tab() === 'requests'" (click)="switchTab('requests')">Requests</button>
      <button [class.on]="tab() === 'worklist'" (click)="switchTab('worklist')">Task worklist</button>
      <button [class.on]="tab() === 'register'" (click)="switchTab('register')">Disclosure register</button>
    </div>

    @switch (tab()) {
      @case ('requests') {
        <div class="toolbar">
          <div class="search"><ui-input placeholder="Search reference / authority…" [(ngModel)]="q" (enter)="applyFilter()" /></div>
          <div class="filt"><ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" /></div>
          <div class="filt"><ui-multiselect placeholder="All types" [options]="typeOptions" [(ngModel)]="typeSel" (ngModelChange)="applyFilter()" /></div>
          <button class="chip" [class.on]="overdue()" (click)="toggleOverdue()"><lucide-icon name="triangle-alert" [size]="13" /> Overdue only</button>
        </div>

        <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No legal requests.">
          @for (r of page()?.content ?? []; track r.id) {
            <tr class="clickable" (click)="open(r)">
              <td class="mono">{{ r.reference }}</td>
              <td>{{ typeLabel(r.requestType) }}</td>
              <td>{{ r.requestingAuthority }}</td>
              <td>{{ r.subjectUserId ? '#' + r.subjectUserId : '—' }}</td>
              <td>
                <span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span>
                @if (r.approvalStatus === 'PENDING' && r.status !== 'REJECTED' && r.status !== 'CLOSED') { <span class="tag warn">approval</span> }
              </td>
              <td>
                @if (r.dueAt) {
                  <span [class.over]="r.overdue">{{ r.dueAt | date: 'MMM d, y' }}</span>
                  @if (r.overdue) { <span class="tag rose">overdue</span> }
                } @else { <span class="muted">—</span> }
              </td>
              <td><span class="count">{{ r.disclosureCount }}</span></td>
            </tr>
          }
        </ui-table>

        <ui-paginator [pageIndex]="pageIndex()" [totalPages]="page()?.totalPages ?? 0"
          [totalElements]="page()?.totalElements ?? 0" unit="request" (pageChange)="goTo($event)" />
      }

      @case ('worklist') {
        <ui-table [columns]="taskCols" [loading]="loading()" [empty]="(tasks()?.content?.length ?? 0) === 0" emptyText="No open tasks 🎉">
          @for (t of tasks()?.content ?? []; track t.id) {
            <tr>
              <td><b>{{ t.title }}</b></td>
              <td><a [routerLink]="['/legal', t.requestId]" class="mono">{{ t.reference }}</a></td>
              <td>{{ typeLabel(t.requestType) }}</td>
              <td>{{ t.assigneeAdminId ? dir.name(t.assigneeAdminId) : '—' }}</td>
              <td>
                @if (t.dueAt) {
                  <span [class.over]="t.overdue">{{ t.dueAt | date: 'MMM d, y' }}</span>
                  @if (t.overdue) { <span class="tag rose">overdue</span> }
                } @else { <span class="muted">—</span> }
              </td>
            </tr>
          }
        </ui-table>
        <ui-paginator [pageIndex]="taskPage()" [totalPages]="tasks()?.totalPages ?? 0"
          [totalElements]="tasks()?.totalElements ?? 0" unit="task" (pageChange)="taskGoTo($event)" />
      }

      @case ('register') {
        <div class="toolbar">
          <div class="spacer"></div>
          <button class="btn" (click)="exportRegister()" [disabled]="(register()?.content?.length ?? 0) === 0"><lucide-icon name="download" [size]="15" /> Export</button>
        </div>
        <ui-table [columns]="discCols" [loading]="loading()" [empty]="(register()?.content?.length ?? 0) === 0" emptyText="No disclosures recorded.">
          @for (d of register()?.content ?? []; track d.id) {
            <tr>
              <td class="muted">{{ d.disclosedAt | date: 'MMM d, y, HH:mm' }}</td>
              <td><a [routerLink]="['/legal', d.requestId]" class="mono">{{ d.reference }}</a></td>
              <td>{{ d.recipient }}</td>
              <td>{{ d.dataCategories }}</td>
              <td>{{ d.disclosedBy ? dir.name(d.disclosedBy) : '—' }}</td>
            </tr>
          }
        </ui-table>
        <ui-paginator [pageIndex]="discPage()" [totalPages]="register()?.totalPages ?? 0"
          [totalElements]="register()?.totalElements ?? 0" unit="disclosure" (pageChange)="discGoTo($event)" />
      }
    }
  `,
  styles: `
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .create { margin-bottom: 18px; }
    .create .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 4px; }
    .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 280px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .toolbar .spacer { flex: 1; }
    .count { font-weight: 700; }
    .kpi .val.bad { color: var(--rose); }
    .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font-size: 12.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; cursor: pointer; font-family: inherit; }
    .chip:hover { color: var(--ink); }
    .chip.on { border-color: rgba(244,63,94,0.4); background: rgba(244,63,94,0.1); color: var(--rose); }
    .tag { display: inline-block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 999px; padding: 1px 7px; margin-left: 7px; vertical-align: middle; }
    .tag.warn { color: var(--amber); background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); }
    .tag.rose { color: var(--rose); background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25); }
    .over { color: var(--rose); font-weight: 600; }
  `,
})
export class LegalListComponent implements OnInit {
  private readonly api = inject(LegalApi);
  private readonly auth = inject(AuthService);
  readonly dir = inject(AdminDirectoryService);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly statusOptions = STATUS_OPTIONS;
  readonly typeOptions = TYPE_OPTIONS;

  readonly tab = signal<Tab>('requests');
  q = '';
  statusSel: string[] = [];
  typeSel: string[] = [];
  readonly overdue = signal(false);
  readonly pageIndex = signal(0);
  readonly taskPage = signal(0);
  readonly discPage = signal(0);

  readonly page = signal<Page<LegalRequestSummary> | null>(null);
  readonly tasks = signal<Page<LegalTaskListRow> | null>(null);
  readonly register = signal<Page<DisclosureRegisterRow> | null>(null);
  readonly stats = signal<LegalStats | null>(null);
  readonly loading = signal(true);
  readonly showCreate = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('LEGAL:EDIT'));

  readonly columns: TableColumn[] = [
    { label: 'Reference' }, { label: 'Type' }, { label: 'Authority' }, { label: 'Subject' },
    { label: 'Status' }, { label: 'Due' }, { label: 'Disclosures' },
  ];
  readonly taskCols: TableColumn[] = [
    { label: 'Task' }, { label: 'Request' }, { label: 'Type' }, { label: 'Assignee' }, { label: 'Due' },
  ];
  readonly discCols: TableColumn[] = [
    { label: 'When' }, { label: 'Request' }, { label: 'Recipient' }, { label: 'Data categories' }, { label: 'By' },
  ];

  draft: Draft = { ...EMPTY_DRAFT };

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.tab.set((qp.get('tab') as Tab) || 'requests');
    this.q = qp.get('q') ?? '';
    this.statusSel = qp.get('status') ? qp.get('status')!.split(',') : [];
    this.typeSel = qp.get('type') ? qp.get('type')!.split(',') : [];
    this.overdue.set(qp.get('overdue') === '1');
    this.pageIndex.set(Number(qp.get('page') ?? 0));
    this.stats.set(null);
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
    this.loadForTab();
  }

  private syncUrl(): void {
    const t = this.tab();
    void this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: {
        tab: t === 'requests' ? null : t,
        q: t === 'requests' && this.q.trim() ? this.q.trim() : null,
        status: t === 'requests' && this.statusSel.length ? this.statusSel.join(',') : null,
        type: t === 'requests' && this.typeSel.length ? this.typeSel.join(',') : null,
        overdue: t === 'requests' && this.overdue() ? '1' : null,
        page: t === 'requests' && this.pageIndex() ? this.pageIndex() : null,
      },
    });
  }

  private loadForTab(): void {
    this.syncUrl();
    switch (this.tab()) {
      case 'requests': this.loadRequests(); break;
      case 'worklist': this.loadTasks(); break;
      case 'register': this.loadRegister(); break;
    }
  }

  private loadRequests(): void {
    this.loading.set(true);
    this.api.list({
      q: this.q.trim() || null, status: this.statusSel, type: this.typeSel,
      overdue: this.overdue(), page: this.pageIndex(), size: 20,
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load legal requests (needs LEGAL:VIEW).'); this.loading.set(false); },
    });
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.api.openTasks(this.taskPage(), 25).subscribe({
      next: (p) => { this.tasks.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  private loadRegister(): void {
    this.loading.set(true);
    this.api.disclosureRegister(this.discPage(), 25).subscribe({
      next: (p) => { this.register.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  switchTab(t: Tab): void {
    if (this.tab() === t) { return; }
    this.tab.set(t);
    this.loadForTab();
  }

  applyFilter(): void { this.pageIndex.set(0); this.loadRequests(); this.syncUrl(); }
  toggleOverdue(): void { this.overdue.update((v) => !v); this.applyFilter(); }
  goTo(i: number): void { this.pageIndex.set(i); this.loadRequests(); this.syncUrl(); }
  taskGoTo(i: number): void { this.taskPage.set(i); this.loadTasks(); }
  discGoTo(i: number): void { this.discPage.set(i); this.loadRegister(); }

  toggleCreate(): void { this.showCreate.update((v) => !v); }

  submit(): void {
    this.busy.set(true);
    this.error.set(null);
    const d = this.draft;
    const body: CreateLegalRequest = {
      reference: d.reference.trim(),
      requestType: d.requestType,
      requestingAuthority: d.requestingAuthority.trim(),
      subjectUserId: d.subjectUserId ? Number(d.subjectUserId) : null,
      scope: d.scope.trim() || null,
      dueAt: d.dueAt ? `${d.dueAt}T00:00:00` : null,
      notes: d.notes.trim() || null,
    };
    this.api.create(body).subscribe({
      next: () => {
        this.busy.set(false);
        this.showCreate.set(false);
        this.draft = { ...EMPTY_DRAFT };
        this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => {} });
        this.loadRequests();
      },
      error: () => { this.busy.set(false); this.error.set('Could not save (duplicate reference?).'); },
    });
  }

  exportRegister(): void {
    const rows = (this.register()?.content ?? []).map((d) => ({
      when: d.disclosedAt, reference: d.reference, type: d.requestType, recipient: d.recipient,
      categories: d.dataCategories, justification: d.justification, by: this.dir.name(d.disclosedBy),
    }));
    if (!rows.length) { return; }
    this.exporter.download('disclosure-register', [
      { key: 'when', label: 'Disclosed at' }, { key: 'reference', label: 'Reference' }, { key: 'type', label: 'Type' },
      { key: 'recipient', label: 'Recipient' }, { key: 'categories', label: 'Data categories' },
      { key: 'justification', label: 'Justification' }, { key: 'by', label: 'Disclosed by' },
    ], rows);
    this.toast.info(`Exported ${rows.length} disclosure(s).`);
  }

  open(r: LegalRequestSummary): void { void this.router.navigate(['/legal', r.id]); }

  typeLabel(value: string): string {
    return TYPE_OPTIONS.find((t) => t.value === value)?.label ?? value;
  }

  statusClass(s: string): string {
    switch (s) {
      case 'RECEIVED': return 'pending';
      case 'UNDER_REVIEW': return 'review';
      case 'ACTIONED': return 'resolved';
      case 'REJECTED': return 'banned';
      default: return 'dismissed';
    }
  }
}
