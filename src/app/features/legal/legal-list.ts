import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { LegalApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { CreateLegalRequest, LegalRequestSummary, Page } from '../../core/models';

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
    FormsModule, DatePipe, TitleCasePipe, IconComponent,
    InputComponent, SelectComponent, MultiSelectComponent, TextareaComponent, TableComponent, PaginatorComponent, PageHeaderComponent,
  ],
  template: `
    <ui-page-header icon="scale" title="Legal & Disclosure" subtitle="Legal requests & the disclosure ledger"
                    tint="amber" [count]="page()?.totalElements ?? null">
      @if (canEdit()) {
        <button page-actions class="btn primary" (click)="toggleCreate()"><lucide-icon name="plus" [size]="15" /> Log request</button>
      }
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (showCreate()) {
      <div class="card create">
        <div class="card-h"><h3>Log a legal request</h3></div>
        <div class="grid">
          <ui-input label="Reference" hint="Court/case number — the legal-process identifier" [(ngModel)]="draft.reference" />
          <ui-select label="Type" [options]="typeOptions" [(ngModel)]="draft.requestType" />
          <ui-input label="Requesting authority" placeholder="e.g. District Court, FBI…" [(ngModel)]="draft.requestingAuthority" />
          <ui-input label="Subject user ID" type="number" placeholder="optional" [(ngModel)]="draft.subjectUserId" />
          <ui-input label="Due date" type="date" [(ngModel)]="draft.dueAt" />
        </div>
        <ui-textarea label="Scope" placeholder="What is being requested…" [rows]="2" [(ngModel)]="draft.scope" />
        <ui-textarea label="Notes" placeholder="Internal notes…" [rows]="2" [(ngModel)]="draft.notes" />
        <div class="actions">
          <button class="btn" (click)="toggleCreate()">Cancel</button>
          <button class="btn primary" (click)="submit()" [disabled]="busy() || !draft.reference.trim() || !draft.requestingAuthority.trim()">Save</button>
        </div>
      </div>
    }

    <div class="filt">
      <ui-multiselect placeholder="All statuses" [options]="statusOptions" [(ngModel)]="statusSel" (ngModelChange)="applyFilter()" />
    </div>

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No legal requests.">
      @for (r of page()?.content ?? []; track r.id) {
        <tr class="clickable" (click)="open(r)">
          <td class="mono">{{ r.reference }}</td>
          <td>{{ typeLabel(r.requestType) }}</td>
          <td>{{ r.requestingAuthority }}</td>
          <td>{{ r.subjectUserId ? '#' + r.subjectUserId : '—' }}</td>
          <td><span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span></td>
          <td class="muted">{{ r.receivedAt | date: 'MMM d, y' }}</td>
          <td><span class="count">{{ r.disclosureCount }}</span></td>
        </tr>
      }
    </ui-table>

    <ui-paginator
      [pageIndex]="pageIndex()"
      [totalPages]="page()?.totalPages ?? 0"
      [totalElements]="page()?.totalElements ?? 0"
      unit="request"
      (pageChange)="goTo($event)"
    />
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .create { margin-bottom: 18px; }
    .create .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 4px; }
    .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
    .filt { width: 260px; max-width: 100%; margin-bottom: 18px; }
    .count { font-weight: 700; }
  `,
})
export class LegalListComponent implements OnInit {
  private readonly api = inject(LegalApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly statusOptions = STATUS_OPTIONS;
  readonly typeOptions = TYPE_OPTIONS;

  statusSel: string[] = [];
  readonly pageIndex = signal(0);
  readonly page = signal<Page<LegalRequestSummary> | null>(null);
  readonly loading = signal(true);
  readonly showCreate = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('LEGAL:EDIT'));

  readonly columns: TableColumn[] = [
    { label: 'Reference' }, { label: 'Type' }, { label: 'Authority' }, { label: 'Subject' },
    { label: 'Status' }, { label: 'Received' }, { label: 'Disclosures' },
  ];

  draft: Draft = { ...EMPTY_DRAFT };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(this.statusSel, this.pageIndex(), 20).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load legal requests (needs LEGAL:VIEW).'); this.loading.set(false); },
    });
  }

  applyFilter(): void { this.pageIndex.set(0); this.load(); }
  goTo(i: number): void { this.pageIndex.set(i); this.load(); }

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
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Could not save (duplicate reference?).'); },
    });
  }

  open(r: LegalRequestSummary): void { void this.router.navigate(['/legal', r.id]); }

  label(s: string): string {
    return s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

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
