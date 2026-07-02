import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { PrivacyApi } from '../../core/privacy.api';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { DsarDetail, DsarStats, DsarSummary, Page, PrivacySettings } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'VERIFYING', label: 'Verifying' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'ACCESS', label: 'Access' },
  { value: 'ERASURE', label: 'Erasure' },
  { value: 'RECTIFICATION', label: 'Rectification' },
  { value: 'PORTABILITY', label: 'Portability' },
  { value: 'RESTRICTION', label: 'Restriction' },
  { value: 'OBJECTION', label: 'Objection' },
];

const RESOLUTIONS: SelectOption[] = [
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'PARTIALLY_FULFILLED', label: 'Partially fulfilled' },
  { value: 'REJECTED_EXEMPT', label: 'Rejected (exempt)' },
  { value: 'NO_DATA', label: 'No data held' },
];

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe, RouterLink, IconComponent,
    InputComponent, MultiSelectComponent, TableComponent, PaginatorComponent, PageHeaderComponent,
  ],
  template: `
    <ui-page-header eyebrow="Governance" icon="shield-check" title="Privacy & DSAR"
      subtitle="Data-subject rights, right-to-erasure & retention policy">
      @if (settings() || canEdit()) {
        <div class="hact" page-actions>
          @if (settings(); as s) {
            <button class="chip" [class.act]="canEdit()" [disabled]="!canEdit()" (click)="showSettings.set(!showSettings())"
              [attr.title]="canEdit() ? 'Edit erasure retention policy' : 'Erasure retention policy'">
              <lucide-icon name="clock" [size]="13" /> Retention: {{ s.erasureRetentionDays }}d
            </button>
          } @else if (canEdit()) {
            <button class="btn ghost" (click)="showSettings.set(!showSettings())"><lucide-icon name="clock" [size]="15" /> Retention</button>
          }
        </div>
      }
    </ui-page-header>

    @if (stats(); as s) {
      <div class="kpis">
        <div class="kpi"><span>Open</span><b>{{ s.open }}</b></div>
        <div class="kpi"><span>Verifying</span><b>{{ s.verifying }}</b></div>
        <div class="kpi"><span>In progress</span><b>{{ s.inProgress }}</b></div>
        <div class="kpi warn"><span>Overdue</span><b>{{ s.overdue }}</b></div>
        <div class="kpi"><span>Awaiting purge</span><b>{{ s.awaitingPurge }}</b></div>
        <div class="kpi"><span>Completed</span><b>{{ s.completed }}</b></div>
      </div>
    }

    @if (showSettings() && canEdit()) {
      <section class="panel rise">
        <h3>Erasure retention policy</h3>
        <p class="muted">Days a soft-erased account is retained before the irreversible hard delete. The window keeps data available for any legal request against the subject.</p>
        <div class="setrow">
          <ui-input type="number" label="Retention (days)" [(ngModel)]="retentionDays" />
          <button class="btn" (click)="saveSettings()" [disabled]="savingSettings()">Save policy</button>
          @if (settings()?.updatedAt) { <span class="muted sm">Updated {{ settings()!.updatedAt | date: 'MMM d, y' }}</span> }
        </div>
      </section>
    }

    <section class="filters">
      <ui-input placeholder="Search reference / email / name…" [(ngModel)]="q" (enter)="onFilter()" />
      <ui-multiselect placeholder="All statuses" [options]="statusOpts" [(ngModel)]="statuses" (ngModelChange)="onFilter()" />
      <ui-multiselect placeholder="All types" [options]="typeOpts" [(ngModel)]="types" (ngModelChange)="onFilter()" />
      <label class="chk"><input type="checkbox" [(ngModel)]="overdueOnly" (ngModelChange)="onFilter()" /> Overdue only</label>
    </section>

    <ui-table [columns]="cols" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0">
      @for (r of page()?.content ?? []; track r.id) {
        <tr class="clickable" (click)="open(r.id)">
          <td><b>{{ r.reference }}</b></td>
          <td>
            <div>{{ r.subjectName || r.subjectEmail }}</div>
            @if (r.subjectUserId) { <a class="ulink sm" [routerLink]="['/users', r.subjectUserId]" (click)="$event.stopPropagation()">@{{ r.subjectUserId }}</a> }
          </td>
          <td><span class="pill">{{ r.requestType | titlecase }}</span></td>
          <td>{{ r.regulation }}</td>
          <td>
            <span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span>
            @if (r.identityVerified) { <lucide-icon name="check" [size]="14" class="vok" /> }
          </td>
          <td>
            @if (r.dueAt) { <span [class.overdue]="r.overdue">{{ r.dueAt | date: 'MMM d' }}</span> } @else { — }
          </td>
          <td>@if (r.purgeAt) { <span class="purge">{{ r.purgeAt | date: 'MMM d, y' }}</span> } @else { — }</td>
        </tr>
      }
    </ui-table>
    @if (page(); as p) {
      <ui-paginator [pageIndex]="p.number" [totalPages]="p.totalPages" [totalElements]="p.totalElements" unit="request" (pageChange)="goTo($event)" />
    }

    @if (detail(); as d) {
      <div class="drawer-scrim" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-label="DSAR detail">
        <header class="drawer-h">
          <div>
            <span class="pill" [class]="statusClass(d.status)">{{ d.status | titlecase }}</span>
            <h2>{{ d.reference }}</h2>
          </div>
          <button class="iconbtn" (click)="close()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>

        <section class="dl">
          <div class="r"><span>Type</span><b>{{ d.requestType | titlecase }} · {{ d.regulation }}</b></div>
          <div class="r"><span>Subject</span><b>{{ d.subjectName || '—' }}<br /><small class="muted">{{ d.subjectEmail }}</small></b></div>
          <div class="r"><span>Account</span><b>@if (d.subjectUserId) { <a class="ulink" [routerLink]="['/users', d.subjectUserId]">@{{ d.subjectUserId }}</a> } @else { not linked }</b></div>
          <div class="r"><span>Identity</span><b>{{ d.identityVerified ? 'Verified' : 'Not verified' }}</b></div>
          <div class="r"><span>Received</span><b>{{ d.receivedAt | date: 'MMM d, y' }}</b></div>
          <div class="r"><span>Due</span><b>{{ (d.dueAt | date: 'MMM d, y') ?? '—' }}</b></div>
          @if (d.erasureExecutedAt) { <div class="r"><span>Erasure ran</span><b>{{ d.erasureExecutedAt | date: 'MMM d, y' }}</b></div> }
          @if (d.purgeAt) { <div class="r"><span>Hard delete</span><b class="purge">{{ d.purgeAt | date: 'MMM d, y' }}</b></div> }
          @if (d.exportUri) { <div class="r"><span>Export</span><b class="mono">{{ d.exportUri }}</b></div> }
          @if (d.resolution) { <div class="r"><span>Resolution</span><b>{{ d.resolution | titlecase }}</b></div> }
        </section>

        @if (canEdit()) {
          <div class="drawer-act">
            @if (!d.identityVerified) { <button class="btn ghost full" (click)="verify(d)">Mark identity verified</button> }
            @if (d.requestType === 'ERASURE' && !d.erasureExecutedAt) {
              <button class="btn danger full" (click)="executeErasure(d)" [disabled]="busy()">Execute erasure</button>
            }
            @if (d.requestType === 'ACCESS' || d.requestType === 'PORTABILITY') {
              <button class="btn ghost full" (click)="recordExport(d)">Record export artifact</button>
            }
            <button class="btn ghost full" (click)="addNote(d)">Add note</button>
            <button class="btn full" (click)="resolve(d)" [disabled]="busy()">Resolve / close</button>
          </div>
        }

        @if (d.events.length) {
          <h4 class="drawer-sub">Activity ({{ d.events.length }})</h4>
          <section class="timeline">
            @for (e of d.events; track e.id) {
              <div class="tl">
                <span class="dot"></span>
                <div><b>{{ e.event | titlecase }}</b>@if (e.detail) { <span class="muted"> — {{ e.detail }}</span> }<br /><small class="muted">{{ e.createdAt | date: 'MMM d, y · HH:mm' }}</small></div>
              </div>
            }
          </section>
        }
      </aside>
    }
  `,
  styleUrl: './privacy.scss',
})
export class PrivacyComponent implements OnInit {
  private readonly api = inject(PrivacyApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly canEdit = computed(() => this.auth.can('PRIVACY:EDIT'));
  readonly statusOpts = STATUS_OPTIONS;
  readonly typeOpts = TYPE_OPTIONS;
  readonly cols: TableColumn[] = [
    { label: 'Reference' }, { label: 'Subject' }, { label: 'Type' }, { label: 'Reg' }, { label: 'Status' }, { label: 'Due' }, { label: 'Hard delete' },
  ];

  readonly page = signal<Page<DsarSummary> | null>(null);
  readonly stats = signal<DsarStats | null>(null);
  readonly detail = signal<DsarDetail | null>(null);
  readonly settings = signal<PrivacySettings | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly savingSettings = signal(false);
  readonly showSettings = signal(false);

  q = '';
  statuses: string[] = [];
  types: string[] = [];
  overdueOnly = false;
  retentionDays = 90;
  private pageIdx = 0;

  ngOnInit(): void {
    this.load();
    this.api.stats().subscribe((s) => this.stats.set(s));
    this.api.settings().subscribe((s) => { this.settings.set(s); this.retentionDays = s.erasureRetentionDays; });
  }

  private load(): void {
    this.loading.set(true);
    this.api.list({ q: this.q, status: this.statuses, type: this.types, overdueOnly: this.overdueOnly, page: this.pageIdx })
      .subscribe({ next: (p) => { this.page.set(p); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  onFilter(): void { this.pageIdx = 0; this.load(); }
  goTo(i: number): void { this.pageIdx = i; this.load(); }

  open(id: number): void {
    this.api.detail(id).subscribe({ next: (d) => this.detail.set(d), error: () => this.toast.error('Could not load case.') });
  }
  close(): void { this.detail.set(null); }

  private refresh(id: number): void { this.open(id); this.load(); this.api.stats().subscribe((s) => this.stats.set(s)); }

  saveSettings(): void {
    this.savingSettings.set(true);
    this.api.updateSettings(Number(this.retentionDays)).subscribe({
      next: (s) => { this.savingSettings.set(false); this.settings.set(s); this.toast.success('Retention policy saved.'); },
      error: () => { this.savingSettings.set(false); this.toast.error('Could not save policy.'); },
    });
  }

  async verify(d: DsarDetail): Promise<void> {
    const r = await this.confirm.confirm({ title: 'Confirm identity verified?', message: 'Record that the subject proved their identity.', confirmLabel: 'Verify', input: { label: 'Note (optional)' } });
    if (!r.confirmed) return;
    this.api.verify(d.id, true, r.value).subscribe({ next: () => { this.toast.success('Identity verified.'); this.refresh(d.id); }, error: () => this.toast.error('Failed.') });
  }

  async executeErasure(d: DsarDetail): Promise<void> {
    const days = this.settings()?.erasureRetentionDays ?? 90;
    const r = await this.confirm.confirm({
      title: 'Execute right-to-erasure?', tone: 'danger', confirmLabel: 'Execute erasure',
      message: `The account will be locked immediately and its data retained for ${days} days (for any legal request), then irreversibly anonymized. This cannot be undone.`,
    });
    if (!r.confirmed) return;
    this.busy.set(true);
    this.api.executeErasure(d.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Erasure executed — purge scheduled.'); this.refresh(d.id); },
      error: () => { this.busy.set(false); this.toast.error('Erasure failed — the service did not confirm it.'); },
    });
  }

  async recordExport(d: DsarDetail): Promise<void> {
    const r = await this.confirm.confirm({ title: 'Record export artifact', confirmLabel: 'Save', input: { label: 'Export URI', placeholder: 's3://… or link', required: true } });
    if (!r.confirmed || !r.value?.trim()) return;
    this.api.recordExport(d.id, r.value.trim()).subscribe({ next: () => { this.toast.success('Export recorded.'); this.refresh(d.id); }, error: () => this.toast.error('Failed.') });
  }

  async addNote(d: DsarDetail): Promise<void> {
    const r = await this.confirm.confirm({ title: 'Add note', confirmLabel: 'Add', input: { label: 'Note', required: true, multiline: true } });
    if (!r.confirmed || !r.value?.trim()) return;
    this.api.addNote(d.id, r.value.trim()).subscribe({ next: () => { this.toast.success('Note added.'); this.refresh(d.id); }, error: () => this.toast.error('Failed.') });
  }

  async resolve(d: DsarDetail): Promise<void> {
    const opts = RESOLUTIONS.map((o) => o.label).join(', ');
    const r = await this.confirm.confirm({
      title: 'Resolve case', confirmLabel: 'Resolve',
      message: `Enter a resolution: ${opts}.`,
      input: { label: 'Resolution + note', placeholder: 'FULFILLED — data exported', required: true, multiline: true },
    });
    if (!r.confirmed || !r.value?.trim()) return;
    const raw = r.value.trim();
    const resolution = (RESOLUTIONS.find((o) => raw.toUpperCase().startsWith(o.value))?.value)
      ?? (raw.split(/[\s—-]/)[0].toUpperCase());
    const note = raw.replace(resolution, '').replace(/^[\s—:-]+/, '').trim();
    this.api.resolve(d.id, resolution, note || undefined).subscribe({
      next: () => { this.toast.success('Case resolved.'); this.refresh(d.id); },
      error: () => this.toast.error('Could not resolve — check the resolution value.'),
    });
  }

  statusClass(s: string): string {
    if (s === 'COMPLETED') return 'resolved';
    if (s === 'REJECTED' || s === 'CANCELLED') return 'banned';
    if (s === 'IN_PROGRESS') return 'pending';
    return '';
  }
}
