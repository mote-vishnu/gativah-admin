import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { InputComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';
import { LegalApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { LegalRequestDetail, RecordDisclosureRequest } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'ACTIONED', label: 'Actioned' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
];

@Component({
  selector: 'app-legal-detail',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe, RouterLink,
    InputComponent, SelectComponent, TextareaComponent, TableComponent,
  ],
  template: `
    <a routerLink="/legal" class="back">‹ Back to legal requests</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (req(); as r) {
      <div class="head">
        <div>
          <h1 class="title">{{ r.reference }}</h1>
          <p class="crumb">{{ typeLabel(r.requestType) }} · {{ r.requestingAuthority }}</p>
        </div>
        <span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span>
      </div>

      <div class="grid">
        <div>
          <div class="card">
            <div class="card-h"><h3>Request</h3></div>
            <div class="meta">
              <div><span>Type</span><b>{{ typeLabel(r.requestType) }}</b></div>
              <div><span>Authority</span><b>{{ r.requestingAuthority }}</b></div>
              <div><span>Subject user</span><b>{{ r.subjectUserId ? '#' + r.subjectUserId : '—' }}</b></div>
              <div><span>Received</span><b>{{ r.receivedAt | date: 'MMM d, y' }}</b></div>
              <div><span>Due</span><b>{{ r.dueAt ? (r.dueAt | date: 'MMM d, y') : '—' }}</b></div>
              @if (r.scope) { <div class="full"><span>Scope</span><p>{{ r.scope }}</p></div> }
              @if (r.notes) { <div class="full"><span>Notes</span><p>{{ r.notes }}</p></div> }
            </div>

            @if (canEdit()) {
              <div class="status-row">
                <ui-select label="Status" [options]="statusOptions" [ngModel]="r.status" (ngModelChange)="changeStatus($event)" />
              </div>
            }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Disclosure ledger</h3><span class="hint">{{ r.disclosures.length }} record(s)</span></div>
            <ui-table [columns]="discCols" [flush]="true" [empty]="r.disclosures.length === 0" emptyText="No disclosures recorded.">
              @for (d of r.disclosures; track d.id) {
                <tr>
                  <td>{{ d.recipient }}</td>
                  <td>{{ d.dataCategories }}</td>
                  <td class="muted">{{ d.justification }}</td>
                  <td>#{{ d.disclosedBy }}</td>
                  <td class="muted">{{ d.disclosedAt | date: 'MMM d, HH:mm' }}</td>
                </tr>
              }
            </ui-table>
          </div>
        </div>

        <div>
          @if (canEdit() && r.status !== 'REJECTED') {
            <div class="card">
              <div class="card-h"><h3>Record a disclosure</h3></div>
              <ui-input label="Recipient" placeholder="Who received the data" [(ngModel)]="disc.recipient" />
              <ui-input label="Data categories" placeholder="e.g. account, content, IP logs" [(ngModel)]="disc.dataCategories" />
              <ui-textarea label="Justification" placeholder="Legal basis for the release…" [rows]="3" [(ngModel)]="disc.justification" />
              <button class="btn primary full" (click)="record()" [disabled]="busy() || !canSubmit()">Record disclosure</button>
              <div class="note" style="margin-top:14px">⚠ Only disclose under a valid legal process. Every disclosure is written to the audit log.</div>
            </div>
          } @else if (!canEdit()) {
            <div class="card"><div class="note">Read-only access to legal requests (no LEGAL:EDIT).</div></div>
          } @else {
            <div class="card"><div class="note">This request was rejected — disclosures are disabled.</div></div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--mono); font-weight: 700; font-size: 20px; margin: 0 0 4px; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .meta > div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .meta > div span { color: var(--muted-2); }
    .meta .full { display: block; }
    .meta .full span { display: block; margin-bottom: 4px; }
    .meta .full p { margin: 0; color: var(--ink-2); line-height: 1.5; }
    .status-row { margin-top: 16px; max-width: 240px; }
    .full { width: 100%; margin-top: 6px; }
    .btn.full { width: 100%; margin-top: 16px; }
  `,
})
export class LegalDetailComponent implements OnInit {
  private readonly api = inject(LegalApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly statusOptions = STATUS_OPTIONS;

  readonly req = signal<LegalRequestDetail | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('LEGAL:EDIT'));

  readonly discCols: TableColumn[] = [
    { label: 'Recipient' }, { label: 'Categories' }, { label: 'Justification' }, { label: 'By' }, { label: 'When' },
  ];

  disc: RecordDisclosureRequest = { recipient: '', dataCategories: '', justification: '' };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.detail(id).subscribe({
      next: (r) => this.req.set(r),
      error: () => this.error.set('Could not load this request.'),
    });
  }

  canSubmit(): boolean {
    return !!this.disc.recipient.trim() && !!this.disc.dataCategories.trim() && !!this.disc.justification.trim();
  }

  changeStatus(status: string): void {
    const r = this.req();
    if (!r) { return; }
    this.api.update(r.id, { status: status as LegalRequestDetail['status'] }).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Could not update status.'),
    });
  }

  record(): void {
    const r = this.req();
    if (!r) { return; }
    this.busy.set(true);
    this.error.set(null);
    this.api.recordDisclosure(r.id, {
      recipient: this.disc.recipient.trim(),
      dataCategories: this.disc.dataCategories.trim(),
      justification: this.disc.justification.trim(),
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.disc = { recipient: '', dataCategories: '', justification: '' };
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Could not record disclosure.'); },
    });
  }

  typeLabel(value: string): string {
    const map: Record<string, string> = {
      SUBPOENA: 'Subpoena', COURT_ORDER: 'Court order', SEARCH_WARRANT: 'Search warrant',
      PRESERVATION: 'Preservation hold', EMERGENCY_REQUEST: 'Emergency request', OTHER: 'Other',
    };
    return map[value] ?? value;
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
