import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';
import { DateRange, DateRangeComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { PaginatorComponent, SortState, TableColumn, TableComponent } from '../../shared/table';
import { ChartComponent } from '../../shared/chart';

import { FinanceApi } from '../../core/finance.api';
import { BillingApi } from '../../core/billing.api';
import { AuthService } from '../../core/auth.service';
import { ExportService } from '../../core/export.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import {
  FinanceOverview,
  FinanceRevenueResponse,
  MrrMovement,
  Page,
  PayoutsResponse,
  TransactionDetail,
  SubscriptionRow,
  TransactionRow,
  WebhookHealth,
} from '../../core/models';

type Tab = 'transactions' | 'subscriptions' | 'webhooks';
type View = 'dashboard' | 'history';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, TitleCasePipe, RouterLink, IconComponent, SelectComponent, DateRangeComponent, TableComponent, PaginatorComponent, ChartComponent],
  template: `
    <h1 class="title">{{ title() }}</h1>
    <p class="crumb">{{ subtitle() }}</p>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (view() === 'dashboard') {
      <div class="row g5">
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="dollar-sign" [size]="16" /></span> MRR</div><div class="val c-orange">{{ money(ov()?.mrr) }}</div><div class="delta flat">ARR {{ money(ov()?.arr) }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="users" [size]="16" /></span> Active subs</div><div class="val c-green">{{ ov()?.activeSubscribers ?? '—' }}</div>
          <div class="delta" [class.up]="(ov()?.newSubs30d ?? 0) > 0">@if ((ov()?.newSubs30d ?? 0) > 0) { ▲ }{{ ov()?.newSubs30d ?? 0 }} new · 30d</div>
        </div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="receipt-text" [size]="16" /></span> Gross · MTD</div><div class="val c-cyan">{{ money(ov()?.grossMtd) }}</div>
          @if (ov()?.grossTrendPct != null) {
            <div class="delta" [class.up]="ov()!.grossTrendPct! >= 0" [class.down]="ov()!.grossTrendPct! < 0">{{ ov()!.grossTrendPct! >= 0 ? '▲' : '▼' }} {{ abs(ov()!.grossTrendPct!) }}% · vs prior 30d</div>
          } @else { <div class="delta flat">net {{ money(ov()?.netMtd) }}</div> }
        </div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="receipt-text" [size]="16" /></span> Churn · 30d</div><div class="val c-violet" [class.bad]="(ov()?.churnRate ?? 0) >= 5">{{ ov()?.churnRate ?? 0 }}%</div><div class="delta flat">{{ ov()?.canceled30d ?? 0 }} canceled</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="credit-card" [size]="16" /></span> Refunds · MTD</div><div class="val c-rose">{{ money(ov()?.refundsMtd) }}</div><div class="delta flat">net {{ money(ov()?.netMtd) }}</div></div>
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

      @if (mm(); as m) {
        <div class="card" style="margin-top:18px">
          <div class="card-h"><h3>MRR movement</h3><span class="hint">trailing 30 days · estimate</span></div>
          <div class="mrrflow">
            <div class="step"><span class="lbl">Start</span><b>{{ money(m.start) }}</b></div>
            <div class="op">+</div>
            <div class="step up"><span class="lbl">New</span><b>{{ money(m.added) }}</b></div>
            <div class="op">−</div>
            <div class="step down"><span class="lbl">Churned</span><b>{{ money(m.churned) }}</b></div>
            <div class="op">=</div>
            <div class="step end"><span class="lbl">End</span><b>{{ money(m.end) }}</b></div>
          </div>
          <div class="wbar">
            <div class="seg base" [style.width.%]="barPct(m.start, m)"></div>
            <div class="seg add" [style.width.%]="barPct(m.added, m)"></div>
          </div>
          <div class="note" style="margin-top:14px">⚠ Estimated from subscription start/cancel dates × normalized plan price. Expansion / contraction / reactivation aren't split out (no plan-change history).</div>
        </div>
      }

      @if (pay(); as p) {
        <div class="card" style="margin-top:18px">
          <div class="card-h"><h3>Estimated payouts by store</h3><span class="hint">trailing {{ p.windowDays }} days · net of commission</span></div>
          <table class="payouts">
            <thead><tr><th>Store</th><th class="r">Gross</th><th class="r">Refunds</th><th class="r">Net</th><th class="r">Fee</th><th class="r">Commission</th><th class="r">Est. payout</th></tr></thead>
            <tbody>
              @for (r of p.platforms; track r.platform) {
                <tr>
                  <td><span class="plat">{{ r.platform }}</span><span class="cnt">{{ r.txnCount }} txn</span></td>
                  <td class="r">{{ money(r.gross) }}</td>
                  <td class="r neg">{{ r.refunds > 0 ? '−' + money(r.refunds) : '—' }}</td>
                  <td class="r">{{ money(r.netGross) }}</td>
                  <td class="r dim">{{ (r.commissionRate * 100) | number:'1.0-1' }}%</td>
                  <td class="r neg">−{{ money(r.commission) }}</td>
                  <td class="r"><b>{{ money(r.payout) }}</b></td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="r">{{ money(p.grossTotal) }}</td>
                <td class="r neg">{{ p.refundTotal > 0 ? '−' + money(p.refundTotal) : '—' }}</td>
                <td class="r">{{ money(p.netGrossTotal) }}</td>
                <td class="r dim">—</td>
                <td class="r neg">−{{ money(p.commissionTotal) }}</td>
                <td class="r"><b>{{ money(p.payoutTotal) }}</b></td>
              </tr>
            </tfoot>
          </table>
          <div class="note" style="margin-top:14px">⚠ Commission is an estimate (Apple/Google 30%, web 2.9%). Actual fees vary by program (small-business / post-year-1 = 15%), currency conversion, and regional tax — reconcile against store payout reports.</div>
        </div>
      }

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
                <tr class="clickable" (click)="openTxn(t.id)">
                  <td class="mono">#{{ t.id }}</td>
                  <td>
                    @if (t.userId) {
                      <a class="ulink" [routerLink]="['/users', t.userId]" (click)="$event.stopPropagation()" title="View user & lifetime value">{{ t.username || ('#' + t.userId) }}</a>
                    } @else { <span class="muted">—</span> }
                  </td>
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

    @if (txnDetail(); as d) {
      <div class="drawer-scrim" (click)="closeTxn()"></div>
      <aside class="drawer" role="dialog" aria-label="Transaction detail">
        <header class="drawer-h">
          <div>
            <span class="pill" [class]="txnClass(d.type)">{{ d.type | titlecase }}</span>
            <h2>Transaction #{{ d.id }}</h2>
          </div>
          <button class="iconbtn" (click)="closeTxn()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>

        <div class="drawer-amt">
          <div class="big" [class.neg]="isNegative(d.type)">{{ isNegative(d.type) ? '−' : '' }}{{ amount(d.grossAmount, d.grossCurrency) }}</div>
          <span class="pill" [class]="statusClass(d.status)">{{ d.status | titlecase }}</span>
          @if (d.environment) { <span class="env">{{ d.environment }}</span> }
        </div>

        <section class="dl">
          <div class="r"><span>User</span><b>@if (d.userId) { <a class="ulink" [routerLink]="['/users', d.userId]" title="View user & lifetime value">{{ d.username || ('#' + d.userId) }}</a> } @else { — }</b></div>
          <div class="r"><span>Product</span><b>{{ d.planCode }} <small class="muted">{{ d.productId }}</small></b></div>
          <div class="r"><span>Platform</span><b>{{ d.platform }}</b></div>
          <div class="r"><span>Country</span><b>{{ d.countryCode ?? '—' }}</b></div>
          <div class="r"><span>Source</span><b>{{ d.source ?? '—' }}</b></div>
          <div class="r"><span>Purchased</span><b>{{ (d.purchasedAt | date: 'MMM d, y · HH:mm') ?? '—' }}</b></div>
          <div class="r"><span>Period</span><b>{{ (d.periodStart | date: 'MMM d') ?? '—' }} → {{ (d.periodEnd | date: 'MMM d, y') ?? '—' }}</b></div>
          <div class="r"><span>Created</span><b>{{ (d.createdAt | date: 'MMM d, y · HH:mm') ?? '—' }}</b></div>
          <div class="r"><span>Store txn</span><b class="mono">{{ d.storeTransactionId ?? '—' }}</b></div>
          <div class="r"><span>Original txn</span><b class="mono">{{ d.originalTransactionId ?? '—' }}</b></div>
          <div class="r"><span>Notification</span><b class="mono">{{ d.notificationUuid ?? '—' }}</b></div>
        </section>

        @if (canRefund() && !isNegative(d.type)) {
          <div class="drawer-act">
            <button class="btn danger full" (click)="refundTxn(d)" [disabled]="refunding()">
              <lucide-icon name="receipt-text" [size]="15" /> Issue refund
            </button>
            <p class="muted xs">Processed by the billing service (idempotent) and written to the audit log.</p>
          </div>
        }

        @if (d.subscription; as s) {
          <h4 class="drawer-sub">Subscription</h4>
          <section class="dl">
            <div class="r"><span>Sub ID</span><b class="mono">#{{ s.id }}</b></div>
            <div class="r"><span>State</span><b><span class="pill" [class]="subClass(s.state)">{{ s.state | titlecase }}</span></b></div>
            <div class="r"><span>Auto-renew</span><b>{{ s.autoRenew ? 'On' : 'Off' }}</b></div>
            <div class="r"><span>Renews</span><b>{{ (s.currentPeriodEnd | date: 'MMM d, y') ?? '—' }}</b></div>
          </section>
        }

        @if (d.relatedTxns.length) {
          <h4 class="drawer-sub">Transaction chain ({{ d.relatedTxns.length }})</h4>
          <section class="chain">
            @for (r of d.relatedTxns; track r.id) {
              <button class="chain-row clickable" (click)="openTxn(r.id)">
                <span class="pill sm" [class]="txnClass(r.type)">{{ r.type | titlecase }}</span>
                <span class="ca">{{ isNegative(r.type) ? '−' : '' }}{{ amount(r.grossAmount, r.grossCurrency) }}</span>
                <span class="cd muted">{{ r.purchasedAt | date: 'MMM d, y' }}</span>
              </button>
            }
          </section>
        }

        @if (d.events.length) {
          <h4 class="drawer-sub">Webhook events ({{ d.events.length }})</h4>
          <section class="events">
            @for (e of d.events; track e.id) {
              <div class="event">
                <span class="dot" [class.ok]="e.status === 'PROCESSED'" [class.bad]="e.status === 'FAILED' || e.status === 'DEAD_LETTER'"></span>
                <div class="ebody">
                  <div class="et">{{ e.eventType }}@if (e.subtype) { <small> · {{ e.subtype }}</small> }</div>
                  <div class="muted">{{ e.status | titlecase }} · {{ (e.receivedAt | date: 'MMM d, HH:mm') ?? '—' }}</div>
                </div>
              </div>
            }
          </section>
        } @else {
          <p class="muted" style="margin-top:14px; font-size:13px">No matched webhook events.</p>
        }
      </aside>
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
    .mrrflow { display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap; }
    .mrrflow .step { flex: 1; min-width: 120px; border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; background: var(--surface-2); }
    .mrrflow .step .lbl { display: block; font-size: 11px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.05em; }
    .mrrflow .step b { font-family: var(--sans); font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .mrrflow .step.up b { color: var(--green); } .mrrflow .step.down b { color: var(--rose); }
    .mrrflow .step.end { border-color: var(--brand-line); }
    .mrrflow .op { display: grid; place-items: center; font-size: 18px; color: var(--muted-2); font-weight: 700; }
    .wbar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: var(--surface-3); margin-top: 14px; }
    .wbar .seg.base { background: var(--brand); }
    .wbar .seg.add { background: var(--green); }
    table.payouts { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.payouts th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); padding: 8px 12px; border-bottom: 1px solid var(--line); font-weight: 600; }
    table.payouts td { padding: 11px 12px; border-bottom: 1px solid var(--line); font-size: 14px; }
    table.payouts th.r, table.payouts td.r { text-align: right; }
    table.payouts td.neg { color: var(--rose); } table.payouts td.dim { color: var(--muted-2); }
    table.payouts .plat { font-weight: 600; }
    table.payouts .cnt { display: block; font-size: 11px; color: var(--muted-2); }
    table.payouts tfoot td { border-bottom: none; border-top: 1px solid var(--line); font-weight: 600; }
    tr.clickable { cursor: pointer; } tr.clickable:hover { background: var(--surface-2); }
    .ulink { color: var(--brand); font-weight: 600; text-decoration: none; } .ulink:hover { text-decoration: underline; }
    .drawer-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; animation: fade .15s ease; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 460px; max-width: 92vw; background: var(--surface); border-left: 1px solid var(--line); z-index: 41; overflow-y: auto; padding: 22px; box-shadow: -12px 0 32px rgba(0,0,0,0.28); animation: slidein .2s ease; }
    @keyframes fade { from { opacity: 0; } } @keyframes slidein { from { transform: translateX(24px); opacity: 0; } }
    .drawer-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .drawer-h h2 { font-family: var(--sans); font-size: 19px; font-weight: 800; margin: 8px 0 0; letter-spacing: -0.01em; }
    .iconbtn { background: none; border: 1px solid var(--line); border-radius: 9px; width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer; color: var(--muted-1); }
    .iconbtn:hover { background: var(--surface-2); }
    .drawer-amt { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 16px 0 6px; }
    .drawer-amt .big { font-family: var(--sans); font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
    .drawer-amt .big.neg { color: var(--rose); }
    .drawer-amt .env { font-size: 11px; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; }
    .dl { margin-top: 14px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .dl .r { display: flex; justify-content: space-between; gap: 16px; padding: 9px 14px; font-size: 13px; }
    .dl .r:nth-child(odd) { background: var(--surface-2); }
    .dl .r span { color: var(--muted-2); flex-shrink: 0; } .dl .r b { text-align: right; word-break: break-all; }
    .dl .r b small { font-weight: 400; }
    .drawer-sub { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); margin: 20px 0 8px; }
    .chain { display: flex; flex-direction: column; gap: 6px; }
    .chain-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; cursor: pointer; font: inherit; }
    .chain-row:hover { border-color: var(--brand-line); }
    .chain-row .ca { font-weight: 700; font-variant-numeric: tabular-nums; } .chain-row .cd { margin-left: auto; font-size: 12px; }
    .pill.sm { font-size: 10px; padding: 1px 7px; }
    .events { display: flex; flex-direction: column; gap: 2px; }
    .event { display: flex; gap: 11px; padding: 9px 4px; border-bottom: 1px solid var(--line); }
    .event .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; background: var(--muted-2); flex-shrink: 0; }
    .event .dot.ok { background: var(--green); } .event .dot.bad { background: var(--rose); }
    .event .et { font-size: 13px; font-weight: 600; } .event .et small { font-weight: 400; color: var(--muted-2); }
    .event .muted { font-size: 12px; }
  `,
})
export class FinanceComponent implements OnInit {
  private readonly api = inject(FinanceApi);
  private readonly billing = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly exporter = inject(ExportService);
  private readonly toast = inject(ToastService);

  readonly canRefund = computed(() => this.auth.can('BILLING:EDIT'));
  readonly refunding = signal(false);

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
  readonly mm = signal<MrrMovement | null>(null);
  readonly pay = signal<PayoutsResponse | null>(null);
  readonly txnDetail = signal<TransactionDetail | null>(null);
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
      this.api.mrrMovement().subscribe({ next: (m) => this.mm.set(m), error: () => {} });
      this.api.payouts(30).subscribe({ next: (p) => this.pay.set(p), error: () => {} });
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
      id: t.id, user: t.username || (t.userId ? '#' + t.userId : ''), product: t.planCode, type: t.type,
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

  abs(v: number): number {
    return Math.abs(v);
  }

  /** Bar width as a fraction of the larger of start/end (so the flow reads visually). */
  barPct(v: number, m: MrrMovement): number {
    const max = Math.max(m.start, m.end, 1);
    return Math.min(100, (Math.max(v, 0) / max) * 100);
  }

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

  statusClass(status: string): string {
    if (status === 'VALID') return 'resolved';
    if (status === 'PENDING') return 'pending';
    return 'banned';
  }

  openTxn(id: number): void {
    this.api.transaction(id).subscribe({
      next: (d) => this.txnDetail.set(d),
      error: () => this.toast.error('Could not load transaction detail.'),
    });
  }

  closeTxn(): void {
    this.txnDetail.set(null);
  }

  async refundTxn(d: TransactionDetail): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Refund transaction #${d.id}?`,
      message: `A full refund of ${this.amount(d.grossAmount, d.grossCurrency)} will be processed by the billing service and written to the audit log. This cannot be undone.`,
      confirmLabel: 'Issue refund',
      tone: 'danger',
      input: { label: 'Reason', placeholder: 'e.g. duplicate charge, goodwill…', required: true, multiline: true },
    });
    if (!res.confirmed) return;
    const reason = (res.value ?? '').trim();
    if (!reason) {
      this.toast.error('A reason is required to issue a refund.');
      return;
    }
    this.refunding.set(true);
    this.billing.refund({ transactionId: d.id, amount: null, reason }).subscribe({
      next: () => {
        this.refunding.set(false);
        this.toast.success(`Refund issued for transaction #${d.id}.`);
        this.openTxn(d.id); // reload the drawer so the new REFUND appears in the chain
        this.loadTxns();
      },
      error: () => {
        this.refunding.set(false);
        this.toast.error('Refund failed — the billing service did not confirm it. No refund was applied.');
      },
    });
  }
}

function round(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}
