import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { DateComponent, InputComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
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

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'NOTE', label: 'Note' },
];

@Component({
  selector: 'app-legal-detail',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe, RouterLink,
    InputComponent, SelectComponent, TextareaComponent, DateComponent, TableComponent,
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

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Tasks</h3><span class="hint">{{ openTasks(r) }} open</span></div>
            @for (t of r.tasks; track t.id) {
              <div class="trow">
                <span class="pill" [class]="t.status === 'DONE' ? 'active' : 'pending'">{{ t.status | titlecase }}</span>
                <div class="grow"><b [class.done]="t.status === 'DONE'">{{ t.title }}</b>
                  <small>{{ t.dueAt ? ('due ' + (t.dueAt | date: 'MMM d')) : '' }}{{ t.assigneeAdminId ? ' · #' + t.assigneeAdminId : '' }}</small></div>
                @if (canEdit() && t.status !== 'DONE') {
                  <button class="btn tiny" (click)="completeTask(t.id)" [disabled]="busy()">Done</button>
                }
              </div>
            } @empty { <div class="empty">No tasks.</div> }
            @if (canEdit()) {
              <div class="addrow">
                <ui-input placeholder="New task…" [(ngModel)]="taskDraft.title" />
                <ui-date [(ngModel)]="taskDraft.dueAt" />
                <button class="btn" (click)="addTask()" [disabled]="busy() || !taskDraft.title.trim()">Add</button>
              </div>
            }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Correspondence</h3><span class="hint">{{ r.correspondence.length }}</span></div>
            @for (c of r.correspondence; track c.id) {
              <div class="trow">
                <span class="pill" [class]="c.direction === 'INBOUND' ? 'review' : c.direction === 'OUTBOUND' ? 'resolved' : 'reason'">{{ c.direction | titlecase }}</span>
                <div class="grow"><span class="muted">{{ c.summary }}</span><small>{{ c.channel || '' }}</small></div>
                <span class="when">{{ c.createdAt | date: 'MMM d' }}</span>
              </div>
            } @empty { <div class="empty">No correspondence logged.</div> }
            @if (canEdit()) {
              <div class="addrow">
                <ui-select [options]="directionOptions" [(ngModel)]="corrDraft.direction" />
                <ui-input placeholder="Summary / note…" [(ngModel)]="corrDraft.summary" />
                <button class="btn" (click)="addCorrespondence()" [disabled]="busy() || !corrDraft.summary.trim()">Log</button>
              </div>
            }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Chain of custody</h3><span class="hint">append-only</span></div>
            @if (r.custody.length) {
              <div class="timeline" style="margin-top:6px">
                @for (e of r.custody; track e.id) {
                  <div class="tl">
                    <div class="when">{{ e.createdAt | date: 'MMM d, HH:mm' }} · {{ e.actorAdminId ? '#' + e.actorAdminId : 'system' }}</div>
                    <div class="what" style="display:flex;align-items:center;gap:8px;margin-top:4px">
                      <span class="pill" [class]="custodyClass(e.event)">{{ e.event | titlecase }}</span>
                      <span class="muted">{{ e.detail || '—' }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else { <div class="empty">No custody events.</div> }
          </div>
        </div>

        <div>
          @if (canEdit()) {
            <div class="card" style="margin-bottom:18px">
              <div class="card-h"><h3>Approval</h3><span class="pill" [class]="approvalClass(r.approvalStatus)">{{ r.approvalStatus | titlecase }}</span></div>
              @if (r.approvalStatus === 'PENDING') {
                <ui-textarea label="Decision note" [rows]="2" placeholder="Authenticity & legal sufficiency…" [(ngModel)]="approvalNote" />
                <div class="acts2">
                  <button class="btn primary" (click)="approve(true)" [disabled]="busy()">Approve</button>
                  <button class="btn danger" (click)="approve(false)" [disabled]="busy()">Reject</button>
                </div>
              } @else {
                <div class="meta">
                  <div><span>Decided by</span><b>{{ r.approvedBy ? '#' + r.approvedBy : '—' }}</b></div>
                  <div><span>When</span><b>{{ r.approvedAt ? (r.approvedAt | date: 'MMM d, y') : '—' }}</b></div>
                  @if (r.approvalNote) { <div class="full"><span>Note</span><p>{{ r.approvalNote }}</p></div> }
                </div>
              }
            </div>
          }
          @if (canEdit() && r.status !== 'REJECTED') {
            @if (r.approvalStatus === 'APPROVED') {
              <div class="card">
                <div class="card-h"><h3>Record a disclosure</h3></div>
                <ui-input label="Recipient" placeholder="Who received the data" [(ngModel)]="disc.recipient" />
                <ui-input label="Data categories" placeholder="e.g. account, content, IP logs" [(ngModel)]="disc.dataCategories" />
                <ui-textarea label="Justification" placeholder="Legal basis for the release…" [rows]="3" [(ngModel)]="disc.justification" />
                <button class="btn primary full" (click)="record()" [disabled]="busy() || !canSubmit()">Record disclosure</button>
                <div class="note" style="margin-top:14px">⚠ Only disclose under a valid legal process. Every disclosure is written to the audit log.</div>
              </div>
            } @else {
              <div class="card"><div class="note">Approve the request before recording disclosures.</div></div>
            }
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
    .acts2 { display: flex; gap: 9px; margin-top: 12px; }
    .acts2 .btn { flex: 1; }
    .trow { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 12.5px; }
    .trow:last-of-type { border-bottom: 0; }
    .trow .grow { flex: 1; min-width: 0; }
    .trow .grow b { font-size: 13px; } .trow .grow b.done { text-decoration: line-through; color: var(--muted-2); }
    .trow .grow small { display: block; color: var(--muted-2); font-size: 10.5px; }
    .trow .grow .muted { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trow .when { font-family: var(--mono); font-size: 10px; color: var(--muted-2); white-space: nowrap; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; }
    .addrow { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
    .addrow ui-input, .addrow ui-select { flex: 1; }
  `,
})
export class LegalDetailComponent implements OnInit {
  private readonly api = inject(LegalApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly statusOptions = STATUS_OPTIONS;
  readonly directionOptions = DIRECTION_OPTIONS;

  readonly req = signal<LegalRequestDetail | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('LEGAL:EDIT'));

  readonly discCols: TableColumn[] = [
    { label: 'Recipient' }, { label: 'Categories' }, { label: 'Justification' }, { label: 'By' }, { label: 'When' },
  ];

  disc: RecordDisclosureRequest = { recipient: '', dataCategories: '', justification: '' };
  approvalNote = '';
  taskDraft: { title: string; dueAt: string } = { title: '', dueAt: '' };
  corrDraft: { direction: string; summary: string } = { direction: 'NOTE', summary: '' };

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

  approve(grant: boolean): void {
    const r = this.req();
    if (!r) { return; }
    this.busy.set(true);
    this.api.approve(r.id, grant, this.approvalNote.trim() || null).subscribe({
      next: () => { this.busy.set(false); this.approvalNote = ''; this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not record the decision.'); },
    });
  }

  addTask(): void {
    const r = this.req();
    if (!r || !this.taskDraft.title.trim()) { return; }
    this.busy.set(true);
    this.api.addTask(r.id, {
      title: this.taskDraft.title.trim(),
      assigneeAdminId: null,
      dueAt: this.taskDraft.dueAt ? `${this.taskDraft.dueAt}T00:00:00` : null,
    }).subscribe({
      next: () => { this.busy.set(false); this.taskDraft = { title: '', dueAt: '' }; this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not add task.'); },
    });
  }

  completeTask(taskId: number): void {
    this.busy.set(true);
    this.api.completeTask(taskId).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not complete task.'); },
    });
  }

  addCorrespondence(): void {
    const r = this.req();
    if (!r || !this.corrDraft.summary.trim()) { return; }
    this.busy.set(true);
    this.api.addCorrespondence(r.id, {
      direction: this.corrDraft.direction,
      channel: null,
      summary: this.corrDraft.summary.trim(),
    }).subscribe({
      next: () => { this.busy.set(false); this.corrDraft = { direction: 'NOTE', summary: '' }; this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not log correspondence.'); },
    });
  }

  openTasks(r: LegalRequestDetail): number {
    return r.tasks.filter((t) => t.status !== 'DONE').length;
  }

  approvalClass(s: string): string {
    return s === 'APPROVED' ? 'active' : s === 'REJECTED' ? 'banned' : 'pending';
  }

  custodyClass(e: string): string {
    switch (e) {
      case 'APPROVED': case 'DISCLOSED': return 'resolved';
      case 'REJECTED': return 'banned';
      case 'RECEIVED': return 'review';
      default: return 'reason';
    }
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
