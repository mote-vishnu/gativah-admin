import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { FinanceApi } from '../../core/finance.api';
import {
  FinanceOverview,
  Page,
  SubscriptionRow,
  TransactionRow,
  WebhookHealth,
} from '../../core/models';

type Tab = 'transactions' | 'subscriptions' | 'webhooks';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [DatePipe, TitleCasePipe],
  template: `
    <h1 class="title">Finance</h1>
    <p class="crumb">Revenue, subscriptions &amp; payouts</p>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="row g4">
      <div class="card kpi"><div class="lab"><span class="ic tint-orange">＄</span> MRR</div><div class="val">{{ money(ov()?.mrr) }}</div><div class="delta flat">ARR {{ money(ov()?.arr) }}</div></div>
      <div class="card kpi"><div class="lab"><span class="ic tint-green">◉</span> Active subs</div><div class="val">{{ ov()?.activeSubscribers ?? '—' }}</div><div class="delta flat">{{ ov()?.trialing ?? 0 }} trialing · {{ ov()?.inGrace ?? 0 }} grace</div></div>
      <div class="card kpi"><div class="lab"><span class="ic tint-cyan">＄</span> Gross · MTD</div><div class="val">{{ money(ov()?.grossMtd) }}</div><div class="delta flat">net {{ money(ov()?.netMtd) }}</div></div>
      <div class="card kpi"><div class="lab"><span class="ic tint-rose">↩</span> Refunds · MTD</div><div class="val">{{ money(ov()?.refundsMtd) }}</div><div class="delta flat">{{ ov()?.canceled30d ?? 0 }} canceled 30d</div></div>
    </div>

    <div class="note" style="margin-top:14px">Amounts are store-gross — Apple/Google commission isn't deducted. MRR uses plan display price.</div>

    <div class="filters" style="margin-top:18px">
      <span class="chip" [class.on]="tab() === 'transactions'" (click)="go('transactions')">Transactions</span>
      <span class="chip" [class.on]="tab() === 'subscriptions'" (click)="go('subscriptions')">Subscriptions</span>
      <span class="chip" [class.on]="tab() === 'webhooks'" (click)="go('webhooks')">Webhooks</span>
    </div>

    @switch (tab()) {
      @case ('transactions') {
        <div class="card" style="padding:6px">
          <table>
            <thead><tr><th>Txn</th><th>User</th><th>Product</th><th>Type</th><th>Gross</th><th>Country</th><th>When</th></tr></thead>
            <tbody>
              @for (t of txns()?.content ?? []; track t.id) {
                <tr>
                  <td class="mono">#{{ t.id }}</td>
                  <td>{{ t.userId }}</td>
                  <td>{{ t.planCode }}</td>
                  <td><span class="pill" [class]="txnClass(t.type)">{{ t.type | titlecase }}</span></td>
                  <td><b>{{ amount(t.grossAmount, t.grossCurrency) }}</b></td>
                  <td>{{ t.countryCode }}</td>
                  <td class="muted">{{ t.purchasedAt | date: 'MMM d, HH:mm' }}</td>
                </tr>
              } @empty { <tr><td colspan="7"><div class="empty">No transactions.</div></td></tr> }
            </tbody>
          </table>
        </div>
      }
      @case ('subscriptions') {
        <div class="card" style="padding:6px">
          <table>
            <thead><tr><th>Sub</th><th>User</th><th>Plan</th><th>Platform</th><th>State</th><th>Auto-renew</th><th>Renews</th></tr></thead>
            <tbody>
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
              } @empty { <tr><td colspan="7"><div class="empty">No subscriptions.</div></td></tr> }
            </tbody>
          </table>
        </div>
      }
      @case ('webhooks') {
        @if (wh(); as w) {
          <div class="row g4">
            <div class="card kpi"><div class="lab"><span class="ic tint-green">✓</span> Processed · 24h</div><div class="val">{{ w.processed24h }}</div></div>
            <div class="card kpi"><div class="lab"><span class="ic tint-rose">☠</span> Dead-letter</div><div class="val">{{ w.deadLetter }}</div></div>
            <div class="card kpi"><div class="lab"><span class="ic tint-amber">✕</span> Failed · 24h</div><div class="val">{{ w.failed24h }}</div></div>
            <div class="card kpi"><div class="lab"><span class="ic tint-cyan">↧</span> Received · 24h</div><div class="val">{{ w.received24h }}</div></div>
          </div>
          <div class="card" style="margin-top:18px;padding:6px">
            <table>
              <thead><tr><th>Event</th><th>Platform</th><th>Type</th><th>Attempts</th><th>Error</th></tr></thead>
              <tbody>
                @for (d of w.recentDeadLetters; track d.id) {
                  <tr><td class="mono">#{{ d.id }}</td><td>{{ d.platform }}</td><td>{{ d.eventType }}</td><td>{{ d.attempts }}</td><td class="muted">{{ d.lastError }}</td></tr>
                } @empty { <tr><td colspan="5"><div class="empty">No dead-letter events 🎉</div></td></tr> }
              </tbody>
            </table>
          </div>
        }
      }
    }
  `,
  styles: `
    .title { font-family: var(--disp); font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
  `,
})
export class FinanceComponent implements OnInit {
  private readonly api = inject(FinanceApi);

  readonly ov = signal<FinanceOverview | null>(null);
  readonly tab = signal<Tab>('transactions');
  readonly txns = signal<Page<TransactionRow> | null>(null);
  readonly subs = signal<Page<SubscriptionRow> | null>(null);
  readonly wh = signal<WebhookHealth | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.overview().subscribe({
      next: (o) => this.ov.set(o),
      error: () => this.error.set('Could not load finance data — is the admin API running?'),
    });
    this.go('transactions');
  }

  go(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'transactions' && !this.txns()) {
      this.api.transactions({ size: 20 }).subscribe({ next: (p) => this.txns.set(p), error: () => {} });
    } else if (tab === 'subscriptions' && !this.subs()) {
      this.api.subscriptions(null).subscribe({ next: (p) => this.subs.set(p), error: () => {} });
    } else if (tab === 'webhooks' && !this.wh()) {
      this.api.webhooks().subscribe({ next: (w) => this.wh.set(w), error: () => {} });
    }
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

  subClass(state: string): string {
    if (state === 'ACTIVE') return 'active';
    if (state === 'TRIALING') return 'review';
    if (state === 'IN_GRACE_PERIOD') return 'pending';
    return 'dismissed';
  }
}
