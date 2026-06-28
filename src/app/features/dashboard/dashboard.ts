import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FinanceApi } from '../../core/finance.api';
import { ModerationApi } from '../../core/moderation.api';
import { FinanceOverview, WebhookHealth } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1 class="title">Dashboard</h1>
    <p class="crumb">Operations overview · live</p>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="row g4">
      <a class="card kpi" routerLink="/moderation">
        <div class="lab"><span class="ic tint-rose">⚑</span> Open reports</div>
        <div class="val">{{ openReports() ?? '—' }}</div>
        <div class="delta flat">pending triage</div>
      </a>
      <a class="card kpi" routerLink="/finance">
        <div class="lab"><span class="ic tint-orange">＄</span> MRR</div>
        <div class="val">{{ money(ov()?.mrr) }}</div>
        <div class="delta flat">ARR {{ money(ov()?.arr) }}</div>
      </a>
      <a class="card kpi" routerLink="/finance">
        <div class="lab"><span class="ic tint-green">◉</span> Active subs</div>
        <div class="val">{{ ov()?.activeSubscribers ?? '—' }}</div>
        <div class="delta flat">{{ ov()?.trialing ?? 0 }} trialing</div>
      </a>
      <a class="card kpi" routerLink="/finance">
        <div class="lab"><span class="ic tint-cyan">↩</span> Net · MTD</div>
        <div class="val">{{ money(ov()?.netMtd) }}</div>
        <div class="delta flat">refunds {{ money(ov()?.refundsMtd) }}</div>
      </a>
    </div>

    @if (webhooks(); as wh) {
      @if (wh.deadLetter > 0) {
        <div class="note" style="margin-top:18px">⚠ {{ wh.deadLetter }} webhook event(s) in dead-letter — needs reconcile (Billing Ops · P2).</div>
      }
    }
  `,
  styles: `
    .title { font-family: var(--disp); font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 22px; }
    a.kpi { display: block; }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly finance = inject(FinanceApi);
  private readonly moderation = inject(ModerationApi);

  readonly ov = signal<FinanceOverview | null>(null);
  readonly openReports = signal<number | null>(null);
  readonly webhooks = signal<WebhookHealth | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.finance.overview().subscribe({
      next: (o) => this.ov.set(o),
      error: () => this.error.set('Could not load finance data — is the admin API running (and migrations applied)?'),
    });
    this.moderation.reports({ status: 'PENDING', size: 1 }).subscribe({
      next: (p) => this.openReports.set(p.totalElements),
      error: () => {},
    });
    this.finance.webhooks().subscribe({ next: (w) => this.webhooks.set(w), error: () => {} });
  }

  money(v: number | null | undefined): string {
    if (v == null) return '—';
    return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}
