import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { DrawerComponent } from '../../shared/drawer';
import { DateComponent, InputComponent, MultiSelectComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { PaginatorComponent, TableColumn, TableComponent } from '../../shared/table';
import { BillingApi } from '../../core/billing.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EntitlementDef, EntitlementRow, Page, RefundRow } from '../../core/models';

type Tab = 'entitlements' | 'refunds';

const SOURCE_OPTIONS: SelectOption[] = [
  { value: 'COMP', label: 'Comp' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
];

@Component({
  selector: 'app-billing-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, TitleCasePipe, IconComponent, PageHeaderComponent,
    InputComponent, SelectComponent, MultiSelectComponent, TextareaComponent, DateComponent,
    TableComponent, PaginatorComponent, DrawerComponent,
  ],
  template: `
    <ui-page-header eyebrow="Finance" [icon]="tab() === 'refunds' ? 'receipt-text' : 'credit-card'"
                    [title]="tab() === 'refunds' ? 'Refunds' : 'Entitlements'"
                    [subtitle]="tab() === 'refunds' ? 'Refunds & chargebacks' : 'Comp grants & entitlement registry'"
                    [tint]="tab() === 'refunds' ? 'rose' : 'green'">
      @if (canEdit() && tab() === 'entitlements') {
        <button page-actions class="btn primary" (click)="openGrant()"><lucide-icon name="plus" [size]="15" /> Grant comp</button>
      }
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }
    @if (message()) { <div class="ok">✓ {{ message() }}</div> }

    @switch (tab()) {
      @case ('entitlements') {
        <div class="toolbar">
          <div class="search"><ui-input placeholder="Search user or code…" [(ngModel)]="q" (enter)="applyFilter()" /></div>
          <div class="filt"><ui-multiselect placeholder="Any source" [options]="sourceOptions" [(ngModel)]="sourceSel" (ngModelChange)="applyFilter()" /></div>
        </div>
        <ui-table [columns]="entCols()" [loading]="loading()" [empty]="(ents()?.content?.length ?? 0) === 0" emptyText="No entitlements.">
          @for (e of ents()?.content ?? []; track e.id) {
            <tr>
              <td>{{ e.username ? '@' + e.username : '#' + e.userId }}</td>
              <td><b>{{ e.name || e.code }}</b> <span class="muted mono">{{ e.code }}</span></td>
              <td><span class="pill" [class]="e.source === 'COMP' ? 'review' : 'active'">{{ e.source | titlecase }}</span></td>
              <td><span class="pill" [class]="e.active ? 'active' : 'dismissed'">{{ e.active ? 'Active' : 'Inactive' }}</span></td>
              <td class="muted">{{ e.expiresAt ? (e.expiresAt | date: 'MMM d, y') : '—' }}</td>
              <td class="muted">{{ e.updatedAt | date: 'MMM d, y' }}</td>
              @if (canEdit()) {
                <td class="rowact">
                  @if (e.source === 'COMP' && e.userId) {
                    <button class="btn tiny danger" (click)="revoke(e)" [disabled]="busy()">Revoke</button>
                  } @else { <span class="muted">—</span> }
                </td>
              }
            </tr>
          }
        </ui-table>
        <ui-paginator [pageIndex]="entPage()" [totalPages]="ents()?.totalPages ?? 0" [totalElements]="ents()?.totalElements ?? 0" unit="entitlement" (pageChange)="entGoTo($event)" />
      }
      @case ('refunds') {
        <ui-table [columns]="refundCols" [loading]="loading()" [empty]="(refunds()?.content?.length ?? 0) === 0" emptyText="No refunds.">
          @for (r of refunds()?.content ?? []; track r.id) {
            <tr>
              <td class="mono">#{{ r.id }}</td>
              <td>{{ r.username ? '@' + r.username : '#' + r.userId }}</td>
              <td>{{ r.planCode }}</td>
              <td><span class="pill banned">{{ r.type | titlecase }}</span></td>
              <td><b>{{ amount(r.grossAmount, r.grossCurrency) }}</b></td>
              <td>{{ r.countryCode }}</td>
              <td class="muted">{{ r.purchasedAt | date: 'MMM d, HH:mm' }}</td>
            </tr>
          }
        </ui-table>
        <ui-paginator [pageIndex]="refundPage()" [totalPages]="refunds()?.totalPages ?? 0" [totalElements]="refunds()?.totalElements ?? 0" unit="refund" (pageChange)="refundGoTo($event)" />
      }
    }

    <ui-drawer [open]="grantOpen()" title="Grant comp entitlement" (closed)="grantOpen.set(false)">
      <ui-input label="User ID" type="number" placeholder="e.g. 42" [(ngModel)]="grant.userId" />
      <ui-select label="Entitlement" [options]="defOptions()" [(ngModel)]="grant.code" />
      <ui-date label="Expires" hint="Leave blank for no expiry" [(ngModel)]="grant.expiresAt" />
      <ui-textarea label="Reason" [rows]="2" placeholder="Why this comp is being granted…" [(ngModel)]="grant.reason" />
      <button drawer-footer class="btn" (click)="grantOpen.set(false)">Cancel</button>
      <button drawer-footer class="btn primary" (click)="submitGrant()" [disabled]="busy() || !grant.userId || !grant.code">Grant</button>
    </ui-drawer>
  `,
  styles: `
    .ok { font-size: 11.5px; color: var(--green); background: rgba(74,222,128,0.09); border: 1px solid rgba(74,222,128,0.26); border-radius: 11px; padding: 11px 14px; margin-bottom: 14px; }
    .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
    .toolbar .search { width: 300px; max-width: 100%; }
    .toolbar .filt { width: 200px; max-width: 100%; }
    .mono { font-family: var(--mono); font-size: 11px; }
    .rowact { text-align: right; white-space: nowrap; }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; }
  `,
})
export class BillingListComponent implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly sourceOptions = SOURCE_OPTIONS;
  readonly tab = signal<Tab>('entitlements');
  readonly ents = signal<Page<EntitlementRow> | null>(null);
  readonly refunds = signal<Page<RefundRow> | null>(null);
  readonly defs = signal<EntitlementDef[]>([]);
  readonly entPage = signal(0);
  readonly refundPage = signal(0);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly grantOpen = signal(false);

  q = '';
  sourceSel: string[] = [];
  grant: { userId: string | number; code: string; expiresAt: string; reason: string } = { userId: '', code: '', expiresAt: '', reason: '' };

  readonly canEdit = computed(() => this.auth.can('BILLING:EDIT'));
  readonly defOptions = computed<SelectOption[]>(() => this.defs().map((d) => ({ value: d.code, label: d.name })));
  readonly entCols = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'User' }, { label: 'Entitlement' }, { label: 'Source' }, { label: 'State' }, { label: 'Expires' }, { label: 'Updated' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });
  readonly refundCols: TableColumn[] = [
    { label: 'Txn' }, { label: 'User' }, { label: 'Plan' }, { label: 'Type' }, { label: 'Amount' }, { label: 'Country' }, { label: 'When' },
  ];

  ngOnInit(): void {
    this.tab.set((this.route.snapshot.data['tab'] as Tab) ?? 'entitlements');
    if (this.tab() === 'refunds') { this.loadRefunds(); } else { this.loadEnts(); }
    this.api.defs().subscribe({ next: (r) => this.defs.set(r.defs), error: () => {} });
  }

  private loadEnts(): void {
    this.loading.set(true);
    const source = this.sourceSel.length === 1 ? this.sourceSel[0] : null;
    this.api.entitlements({ q: this.q.trim() || null, source, page: this.entPage(), size: 20 }).subscribe({
      next: (p) => { this.ents.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load entitlements (needs BILLING:VIEW).'); this.loading.set(false); },
    });
  }

  private loadRefunds(): void {
    this.loading.set(true);
    this.api.refunds(this.refundPage(), 20).subscribe({
      next: (p) => { this.refunds.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load refunds.'); this.loading.set(false); },
    });
  }

  applyFilter(): void { this.entPage.set(0); this.loadEnts(); }
  entGoTo(i: number): void { this.entPage.set(i); this.loadEnts(); }
  refundGoTo(i: number): void { this.refundPage.set(i); this.loadRefunds(); }

  openGrant(): void {
    this.grant = { userId: '', code: this.defs()[0]?.code ?? '', expiresAt: '', reason: '' };
    this.grantOpen.set(true);
  }

  submitGrant(): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.grantComp({
      userId: Number(this.grant.userId),
      code: this.grant.code,
      expiresAt: this.grant.expiresAt ? `${this.grant.expiresAt}T00:00:00` : null,
      reason: this.grant.reason.trim() || null,
    }).subscribe({
      next: () => { this.busy.set(false); this.grantOpen.set(false); this.toast.success('Comp entitlement granted.'); this.entPage.set(0); this.loadEnts(); },
      error: () => { this.busy.set(false); this.toast.error('Grant failed — check the user id / internal hook.'); },
    });
  }

  async revoke(e: EntitlementRow): Promise<void> {
    if (!e.userId) { return; }
    const res = await this.confirm.confirm({
      title: `Revoke "${e.name || e.code}"?`,
      message: `This removes the comp entitlement from ${e.username ? '@' + e.username : '#' + e.userId}.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.revokeComp(e.userId, e.code).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Entitlement revoked.'); this.loadEnts(); },
      error: () => { this.busy.set(false); this.toast.error('Revoke failed.'); },
    });
  }

  amount(v: number, ccy: string): string {
    return (ccy || '') + ' ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
  }
}
