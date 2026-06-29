import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IconComponent } from '../../shared/icon';
import { DateRange, DateRangeComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { PaginatorComponent, SortState, TableColumn, TableComponent } from '../../shared/table';
import { ChartComponent } from '../../shared/chart';

import { FinanceApi } from '../../core/finance.api';
import { ExportService } from '../../core/export.service';
import { ToastService } from '../../shared/toast/toast.service';
import {
  FinanceOverview,
  FinanceRevenueResponse,
  Page,
  SubscriptionRow,
  TransactionRow,
  WebhookHealth,
} from '../../core/models';

type Tab = 'transactions' | 'subscriptions' | 'webhooks';
type View = 'dashboard' | 'history';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, IconComponent, SelectComponent, DateRangeComponent, TableComponent, PaginatorComponent, ChartComponent],
  template: `
    <h1 class="title">{{ title() }}</h1>
    <p class="crumb">{{ subtitle() }}</p>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (view() === 'dashboard') {
      <div class="row g4">
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="dollar-sign" [size]="16" /></span> MRR</div><div class="val">{{ money(ov()?.mrr) }}</div><div class="delta flat">ARR {{ money(ov()?.arr) }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="users" [size]="16" /></span> Active subs</div><div class="val">{{ ov()?.activeSubscribers ?? '—' }}</div><div class="delta flat">{{ ov()?.trialing ?? 0 }} trialing · {{ ov()?.inGrace ?? 0 }} grace</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="receipt-text" [size]="16" /></span> Gross · MTD</div><div class="val">{{ money(ov()?.grossMtd) }}</div><div class="delta flat">net {{ money(ov()?.netMtd) }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="credit-card" [size]="16" /></span> Refunds · MTD</div><div class="val">{{ money(ov()?.refundsMtd) }}</div><div class="delta flat">{{ ov()?.canceled30d ?? 0 }} canceled 30d</div></div>
      </div>

      <div class="note" style="margin-top:14px">Amounts are store-gross — Apple/Google commission isn't deducted. MRR uses plan display price.</div>

      <div class="card" style="margin-top:18px">
        <div class="card-h">
          <h3>Revenue</h3>
          <div class="rev-controls">
            <ui-date-range [(ngModel)]="range" (ngModelChange)="loadRevenue()" />
            <div class="subtabs">
              <button [class.on]="gran() === 'month'" (click)="setGran('month')">Monthly</button>
              <button [class.on]="gran() === 'day'" (click)="setGran('day')">Daily</button>
            </div>
          </div>
        </div>
        @if (rev()) {
          <ui-chart type="area" [series]="revSeries()" [categories]="revCats()" [colors]="revColors" [height]="300" />
        } @else {
          <div class="empty">Loading revenue…</div>
        }
      </div>

      <div class="row g2" style="margin-top:18px">
        <div class="card">
          <div class="card-h">
            <h3>Revenue breakdown</h3>
            <div class="subtabs">
              @for (d of dims; track d.key) {
                <button [class.on]="breakdownBy() === d.key" (click)="setBreakdown(d.key)">{{ d.label }}</button>
              }
            </div>
          </div>
          @if (rev(); as r) {
            @if (r.breakdown.length) {
              <ui-chart type="bar" [series]="breakdownSeries()" [categories]="breakdownCats()" [colors]="breakdownColors" [options]="breakdownOpts" [height]="breakdownHeight()" />
            } @else {
              <div class="empty">No revenue in this window.</div>
            }
          } @else {
            <div class="empty">Loading…</div>
          }
        </div>
        <div class="card">
          <div class="card-h"><h3>Subscriptions</h3><span class="hint">current mix</span></div>
          @if (ov()) {
            <ui-chart type="donut" [series]="subSeries()" [colors]="subColors" [options]="donutOpts" [height]="300" />
          } @else {
            <div class="empty">Loading…</div>
          }
        </div>
      </div>
    }

    @if (view() === 'history') {
      <div>
        @switch (tab()) {
          @case ('transactions') {
            <div class="ffilters">
              <div class="f"><ui-select [options]="txnTypeOptions" [(ngModel)]="txnType" (ngModelChange)="filterTxns()" /></div>
              <div class="f"><ui-select [options]="platformOptions" [(ngModel)]="txnPlatform" (ngModelChange)="filterTxns()" /></div>
              <div class="spacer"></div>
              <button class="btn" (click)="exportTxns()" [disabled]="(txns()?.content?.length ?? 0) === 0"><lucide-icon name="download" [size]="15" /> Export</button>
            </div>
            <ui-table [columns]="txnCols" [empty]="(txns()?.content?.length ?? 0) === 0" emptyText="No transactions."
                      [sort]="txnSort()" (sortChange)="onTxnSort($event)">
              @for (t of txns()?.content ?? []; track t.id) {
                <tr>
                  <td class="mono">#{{ t.id }}</td>
                  <td>{{ t.userId }}</td>
                  <td>{{ t.planCode }}</td>
                  <td><span class="pill" [class]="txnClass(t.type)">{{ t.type | titlecase }}</span></td>
                  <td><b [class.neg]="isNegative(t.type)">{{ isNegative(t.type) ? '−' : '' }}{{ amount(t.grossAmount, t.grossCurrency) }}</b></td>
                  <td>{{ t.countryCode }}</td>
                  <td class="muted">{{ t.purchasedAt | date: 'MMM d, HH:mm' }}</td>
                </tr>
              }
            </ui-table>
            <ui-paginator [pageIndex]="txnPage()" [totalPages]="txns()?.totalPages ?? 0"
                          [totalElements]="txns()?.totalElements ?? 0" unit="transaction" (pageChange)="txnGoTo($event)" />
          }
          @case ('subscriptions') {
            <div class="ffilters">
              <div class="f"><ui-select [options]="subStateOptions" [(ngModel)]="subState" (ngModelChange)="filterSubs()" /></div>
            </div>
            <ui-table [columns]="subCols" [empty]="(subs()?.content?.length ?? 0) === 0" emptyText="No subscriptions."
                      [sort]="subSort()" (sortChange)="onSubSort($event)">
              @for (s of subs()?.content ?? []; track s.id) {
                <tr>
                  <td class="mono">#{{ s.id }}</td>
                  <td>{{ s.userId }}</td>
                  <td>{{ s.planCode }}</td>
                  <td>{{ s.platform }}</td>
                  <td><span class="pill" [class]="subClass(s.state)">{{ s.state | titlecase }}</span></td>
                  <td>{{ s.autoRenew ? 'On' : 'Off' }}</td>
                  <td class="muted">{{ s.currentPeriodEnd | date: 'MMM d, y' }}</td>
                </tr>
              }
            </ui-table>
            <ui-paginator [pageIndex]="subPage()" [totalPages]="subs()?.totalPages ?? 0"
                          [totalElements]="subs()?.totalElements ?? 0" unit="subscription" (pageChange)="subGoTo($event)" />
          }
          @case ('webhooks') {
            @if (wh(); as w) {
              <div class="row g4">
                <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="check" [size]="16" /></span> Processed · 24h</div><div class="val">{{ w.processed24h }}</div></div>
                <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="ban" [size]="16" /></span> Dead-letter</div><div class="val">{{ w.deadLetter }}</div></div>
                <div class="card kpi"><div class="lab"><span class="ic tint-amber"><lucide-icon name="triangle-alert" [size]="16" /></span> Failed · 24h</div><div class="val">{{ w.failed24h }}</div></div>
                <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="webhook" [size]="16" /></span> Received · 24h</div><div class="val">{{ w.received24h }}</div></div>
              </div>
              <div style="margin-top:18px">
                <ui-table [columns]="dlCols" [empty]="w.recentDeadLetters.length === 0" emptyText="No dead-letter events 🎉">
                  @for (d of w.recentDeadLetters; track d.id) {
                    <tr><td class="mono">#{{ d.id }}</td><td>{{ d.platform }}</td><td>{{ d.eventType }}</td><td>{{ d.attempts }}</td><td class="muted">{{ d.lastError }}</td></tr>
                  }
                </ui-table>
              </div>
            }
          }
        }
      </div>
    }
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
    .rev-controls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .ffilters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .ffilters .f { width: 190px; max-width: 100%; }
    .ffilters .spacer { flex: 1; }
    .ffilters .btn { display: inline-flex; align-items: center; gap: 7px; }
    b.neg { color: var(--rose); }
  `,
})
export class FinanceComponent implements OnInit {
  private readonly api = inject(FinanceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);

  readonly txnCols: TableColumn[] = [
    { label: 'Txn' }, { label: 'User' }, { label: 'Product' }, { label: 'Type', sortKey: 'type' },
    { label: 'Gross', sortKey: 'gross' }, { label: 'Country' }, { label: 'When', sortKey: 'purchasedAt' },
  ];
  readonly subCols: TableColumn[] = [
    { label: 'Sub' }, { label: 'User' }, { label: 'Plan' }, { label: 'Platform', sortKey: 'platform' },
    { label: 'State', sortKey: 'state' }, { label: 'Auto-renew' }, { label: 'Renews', sortKey: 'renews' },
  ];
  readonly dlCols: TableColumn[] = [
    { label: 'Event' }, { label: 'Platform' }, { label: 'Type' }, { label: 'Attempts' }, { label: 'Error' },
  ];

  readonly revColors = ['--brand', '--rose'];
  readonly breakdownColors = ['--brand', '--cyan', '--violet', '--green', '--amber', '--rose'];
  readonly subColors = ['--green', '--cyan', '--amber', '--rose'];
  readonly dims = [
    { key: 'product' as const, label: 'Product' },
    { key: 'platform' as const, label: 'Platform' },
    { key: 'country' as const, label: 'Country' },
    { key: 'currency' as const, label: 'Currency' },
  ];
  readonly breakdownOpts = {
    plotOptions: { bar: { horizontal: true, borderRadius: 6, distributed: true } },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => '$' + Number(v).toLocaleString('en-US') } },
  };
  readonly donutOpts = {
    labels: ['Active', 'Trialing', 'In grace', 'Canceled 30d'],
    legend: { position: 'bottom' },
    plotOptions: { pie: { donut: { size: '68%' } } },
    stroke: { width: 0 },
  };

  readonly ov = signal<FinanceOverview | null>(null);
  readonly rev = signal<FinanceRevenueResponse | null>(null);
  readonly gran = signal<'month' | 'day'>('month');
  readonly breakdownBy = signal<'product' | 'platform' | 'country' | 'currency'>('product');
  readonly view = signal<View>('dashboard');
  readonly tab = signal<Tab>('transactions');

  readonly revSeries = computed(() => {
    const s = this.rev()?.series ?? [];
    return [
      { name: 'Gross', data: s.map((p) => round(p.gross)) },
      { name: 'Refunds', data: s.map((p) => round(p.refunds)) },
    ];
  });
  readonly revCats = computed(() => (this.rev()?.series ?? []).map((p) => p.period));
  readonly breakdownSeries = computed(() => [
    { name: 'Gross', data: (this.rev()?.breakdown ?? []).map((b) => round(b.gross)) },
  ]);
  readonly breakdownCats = computed(() => (this.rev()?.breakdown ?? []).map((b) => b.key ?? '—'));
  readonly breakdownHeight = computed(() => Math.max(160, (this.rev()?.breakdown ?? []).length * 40 + 60));
  readonly subSeries = computed(() => {
    const o = this.ov();
    return o ? [o.activeSubscribers, o.trialing, o.inGrace, o.canceled30d] : [];
  });
  readonly txns = signal<Page<TransactionRow> | null>(null);
  readonly subs = signal<Page<SubscriptionRow> | null>(null);
  readonly wh = signal<WebhookHealth | null>(null);
  readonly error = signal<string | null>(null);

  readonly txnPage = signal(0);
  readonly subPage = signal(0);
  readonly txnSort = signal<SortState | null>(null);
  readonly subSort = signal<SortState | null>(null);
  txnType = '';
  txnPlatform = '';
  subState = '';
  range: DateRange = { from: null, to: null };
  readonly txnTypeOptions: SelectOption[] = [
    { value: '', label: 'All types' },
    { value: 'PURCHASE', label: 'Purchases' },
    { value: 'RENEWAL', label: 'Renewals' },
    { value: 'REFUND', label: 'Refunds' },
    { value: 'CHARGEBACK', label: 'Chargebacks' },
  ];
  readonly platformOptions: SelectOption[] = [
    { value: '', label: 'All platforms' },
    { value: 'IOS', label: 'iOS' },
    { value: 'ANDROID', label: 'Android' },
  ];
  readonly subStateOptions: SelectOption[] = [
    { value: '', label: 'All states' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'TRIALING', label: 'Trialing' },
    { value: 'IN_GRACE_PERIOD', label: 'In grace' },
    { value: 'CANCELED', label: 'Canceled' },
  ];

  readonly title = computed(() => {
    if (this.view() === 'dashboard') { return 'Finance · Dashboard'; }
    switch (this.tab()) {
      case 'subscriptions': return 'Subscriptions';
      case 'webhooks': return 'Webhook health';
      default: return 'Transactions';
    }
  });
  readonly subtitle = computed(() => {
    if (this.view() === 'dashboard') { return 'Revenue, subscriptions & payouts'; }
    switch (this.tab()) {
      case 'subscriptions': return 'Active subscriptions by state';
      case 'webhooks': return 'Store webhook processing & dead-letters';
      default: return 'Purchases, renewals, refunds & chargebacks';
    }
  });

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.view.set((data['view'] as View) ?? 'dashboard');
    if (this.view() === 'dashboard') {
      this.api.overview().subscribe({
        next: (o) => this.ov.set(o),
        error: () => this.error.set('Could not load finance data — is the admin API running?'),
      });
      this.loadRevenue();
    } else {
      this.tab.set((data['tab'] as Tab) ?? 'transactions');
      this.go(this.tab());
    }
  }

  loadRevenue(): void {
    this.rev.set(null);
    this.api.revenue(this.gran(), this.breakdownBy(), this.range.from, this.range.to)
      .subscribe({ next: (r) => this.rev.set(r), error: () => {} });
  }

  setGran(g: 'month' | 'day'): void {
    if (this.gran() === g) { return; }
    this.gran.set(g);
    this.rev.set(null);
    this.loadRevenue();
  }

  setBreakdown(d: 'product' | 'platform' | 'country' | 'currency'): void {
    if (this.breakdownBy() === d) { return; }
    this.breakdownBy.set(d);
    this.rev.set(null);
    this.loadRevenue();
  }

  go(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'transactions') {
      this.loadTxns();
    } else if (tab === 'subscriptions') {
      this.loadSubs();
    } else if (tab === 'webhooks' && !this.wh()) {
      this.api.webhooks().subscribe({ next: (w) => this.wh.set(w), error: () => {} });
    }
  }

  private loadTxns(): void {
    const s = this.txnSort();
    this.api.transactions({
      type: this.txnType || null,
      platform: this.txnPlatform || null,
      sort: s ? `${s.key},${s.dir}` : null,
      page: this.txnPage(),
      size: 20,
    }).subscribe({ next: (p) => this.txns.set(p), error: () => {} });
  }

  private loadSubs(): void {
    const s = this.subSort();
    this.api.subscriptions({
      state: this.subState || null,
      sort: s ? `${s.key},${s.dir}` : null,
      page: this.subPage(),
      size: 20,
    }).subscribe({ next: (p) => this.subs.set(p), error: () => {} });
  }

  onTxnSort(s: SortState): void { this.txnSort.set(s); this.txnPage.set(0); this.loadTxns(); }
  onSubSort(s: SortState): void { this.subSort.set(s); this.subPage.set(0); this.loadSubs(); }

  exportTxns(): void {
    const rows = (this.txns()?.content ?? []).map((t) => ({
      id: t.id, user: t.userId, product: t.planCode, type: t.type,
      gross: t.grossAmount, currency: t.grossCurrency, country: t.countryCode, when: t.purchasedAt,
    }));
    if (!rows.length) { return; }
    this.exporter.download('transactions', [
      { key: 'id', label: 'Txn' }, { key: 'user', label: 'User' }, { key: 'product', label: 'Product' },
      { key: 'type', label: 'Type' }, { key: 'gross', label: 'Gross' }, { key: 'currency', label: 'Currency' },
      { key: 'country', label: 'Country' }, { key: 'when', label: 'When' },
    ], rows);
    this.toast.info(`Exported ${rows.length} transaction(s).`);
  }

  filterTxns(): void { this.txnPage.set(0); this.loadTxns(); }
  filterSubs(): void { this.subPage.set(0); this.loadSubs(); }
  txnGoTo(i: number): void { this.txnPage.set(i); this.loadTxns(); }
  subGoTo(i: number): void { this.subPage.set(i); this.loadSubs(); }

  money(v: number | null | undefined): string {
    return v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  amount(v: number, ccy: string): string {
    return (ccy || '') + ' ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
  }

  txnClass(type: string): string {
    return type === 'REFUND' || type === 'CHARGEBACK' ? 'banned' : 'resolved';
  }

  isNegative(type: string): boolean {
    return type === 'REFUND' || type === 'CHARGEBACK';
  }

  subClass(state: string): string {
    if (state === 'ACTIVE') return 'active';
    if (state === 'TRIALING') return 'review';
    if (state === 'IN_GRACE_PERIOD') return 'pending';
    return 'dismissed';
  }
}

function round(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}
