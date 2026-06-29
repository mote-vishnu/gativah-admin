import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';
import { ChartComponent } from '../../shared/chart';

import { AuditApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { FinanceApi } from '../../core/finance.api';
import { ModerationApi } from '../../core/moderation.api';
import { AuditEntryRow, FinanceOverview, FinanceRevenueResponse, ReasonCount, ReportSummary, WebhookHealth } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent, DatePipe, TitleCasePipe, ChartComponent],
  template: `
    <h1 class="title">Dashboard</h1>
    <p class="crumb">Operations overview · live</p>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="row g4">
      <a class="card kpi" routerLink="/moderation/queue">
        <div class="lab"><span class="ic tint-rose"><lucide-icon name="flag" [size]="16" /></span> Open reports</div>
        <div class="val">{{ openReports() ?? '—' }}</div>
        <div class="delta flat">pending triage</div>
      </a>
      <a class="card kpi" routerLink="/finance/dashboard">
        <div class="lab"><span class="ic tint-orange"><lucide-icon name="dollar-sign" [size]="16" /></span> MRR</div>
        <div class="val">{{ money(ov()?.mrr) }}</div>
        <div class="delta flat">ARR {{ money(ov()?.arr) }}</div>
      </a>
      <a class="card kpi" routerLink="/finance/dashboard">
        <div class="lab"><span class="ic tint-green"><lucide-icon name="users" [size]="16" /></span> Active subs</div>
        <div class="val">{{ ov()?.activeSubscribers ?? '—' }}</div>
        <div class="delta flat">{{ ov()?.trialing ?? 0 }} trialing</div>
      </a>
      <a class="card kpi" routerLink="/finance/dashboard">
        <div class="lab"><span class="ic tint-cyan"><lucide-icon name="credit-card" [size]="16" /></span> Net · MTD</div>
        <div class="val">{{ money(ov()?.netMtd) }}</div>
        <div class="delta flat">refunds {{ money(ov()?.refundsMtd) }}</div>
      </a>
    </div>

    @if (canFinance()) {
      <div class="row g2" style="margin-top:18px">
        <div class="card">
          <div class="card-h"><h3>Revenue</h3><span class="hint">last 12 months</span></div>
          @if (rev()) {
            <ui-chart type="area" [series]="revSeries()" [categories]="revCats()" [colors]="revColors" [height]="260" />
          } @else {
            <div class="empty">Loading revenue…</div>
          }
        </div>
        <div class="card">
          <div class="card-h"><h3>Subscriptions</h3><span class="hint">current mix</span></div>
          @if (ov()) {
            <ui-chart type="donut" [series]="subSeries()" [colors]="subColors" [options]="donutOpts" [height]="260" />
          } @else {
            <div class="empty">Loading…</div>
          }
        </div>
      </div>
    }

    @if (canGrievances()) {
      <div class="row g2" style="margin-top:18px">
        <div class="card">
          <div class="card-h"><h3>Queue by reason</h3><span class="hint">open reports</span></div>
          @if (byReason().length) {
            <ui-chart type="bar" [series]="reasonSeries()" [categories]="reasonCats()" [colors]="['--rose']" [options]="reasonOpts" [height]="240" />
          } @else { <div class="empty">No open reports 🎉</div> }
        </div>
        <div class="card">
          <div class="card-h"><h3>Newest grievances</h3><a class="hint" routerLink="/moderation/queue">View all →</a></div>
          @for (r of newest(); track r.id) {
            <a class="act" [routerLink]="['/moderation', r.id]">
              <span class="dot"></span>
              <div class="grow"><b>{{ r.contentType | titlecase }}</b> · {{ snippet(r) }} <small>{{ r.reporterUsername ? '@' + r.reporterUsername : '' }}</small></div>
              <span class="pill reason">{{ r.reason }}</span>
            </a>
          } @empty { <div class="empty">No open grievances.</div> }
        </div>
      </div>
    }

    <div class="row g2" style="margin-top:18px">
      <div class="card">
        <div class="card-h"><h3>System health</h3><span class="hint">live</span></div>
        @if (webhooks(); as wh) {
          <div class="hrow"><span class="led" [class.g]="wh.deadLetter === 0" [class.r]="wh.deadLetter > 0"></span><div class="grow"><b>Store webhooks</b><br/><small>{{ wh.processed24h }} processed · {{ wh.failed24h }} failed (24h)</small></div><span class="pill" [class]="wh.deadLetter > 0 ? 'banned' : 'active'">{{ wh.deadLetter > 0 ? wh.deadLetter + ' dead-letter' : 'OK' }}</span></div>
          <div class="hrow"><span class="led g"></span><div class="grow"><b>Admin API ↔ pacegrit</b><br/><small>internal hooks</small></div><span class="pill active">OK</span></div>
        } @else {
          <div class="empty">Health unavailable.</div>
        }
      </div>
      <div class="card">
        <div class="card-h"><h3>Recent operator activity</h3><span class="hint">audit</span></div>
        @for (a of recent(); track a.id) {
          <div class="act"><span class="dot"></span><div class="grow"><b>#{{ a.adminUserId }}</b> · {{ a.action }} <small>{{ a.summary }}</small></div><span class="when">{{ a.createdAt | date: 'HH:mm' }}</span></div>
        } @empty {
          <div class="empty">No recent activity.</div>
        }
      </div>
    </div>
  `,
  styles: `
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 22px; }
    a.kpi { display: block; }
    .hrow, .act { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .hrow:last-child, .act:last-child { border-bottom: 0; }
    .hrow .grow, .act .grow { flex: 1; }
    .hrow small, .act small { color: var(--muted-2); font-size: 11.5px; }
    .led { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--muted-2); }
    .led.g { background: var(--green); box-shadow: 0 0 0 3px rgba(74,222,128,0.18); }
    .led.r { background: var(--rose); box-shadow: 0 0 0 3px rgba(251,113,133,0.18); }
    .act .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--brand); flex-shrink: 0; }
    .when { font-family: var(--mono); font-size: 11px; color: var(--muted-2); }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly finance = inject(FinanceApi);
  private readonly moderation = inject(ModerationApi);
  private readonly audit = inject(AuditApi);
  private readonly auth = inject(AuthService);

  readonly revColors = ['--brand', '--rose'];
  readonly subColors = ['--green', '--cyan', '--amber', '--rose'];
  readonly donutOpts = {
    labels: ['Active', 'Trialing', 'In grace', 'Canceled 30d'],
    legend: { position: 'bottom' },
    plotOptions: { pie: { donut: { size: '68%' } } },
    stroke: { width: 0 },
  };

  readonly reasonOpts = {
    plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
    legend: { show: false },
    dataLabels: { enabled: false },
  };

  readonly ov = signal<FinanceOverview | null>(null);
  readonly rev = signal<FinanceRevenueResponse | null>(null);
  readonly openReports = signal<number | null>(null);
  readonly webhooks = signal<WebhookHealth | null>(null);
  readonly recent = signal<AuditEntryRow[]>([]);
  readonly byReason = signal<ReasonCount[]>([]);
  readonly newest = signal<ReportSummary[]>([]);
  readonly error = signal<string | null>(null);

  readonly canFinance = computed(() => this.auth.can('FINANCE:VIEW'));
  readonly canGrievances = computed(() => this.auth.can('GRIEVANCES:VIEW'));
  readonly reasonSeries = computed(() => [{ name: 'Open', data: this.byReason().map((r) => r.count) }]);
  readonly reasonCats = computed(() => this.byReason().map((r) => r.reason));
  readonly revSeries = computed(() => {
    const s = this.rev()?.series ?? [];
    return [
      { name: 'Gross', data: s.map((p) => Math.round((Number(p.gross) || 0) * 100) / 100) },
      { name: 'Refunds', data: s.map((p) => Math.round((Number(p.refunds) || 0) * 100) / 100) },
    ];
  });
  readonly revCats = computed(() => (this.rev()?.series ?? []).map((p) => p.period));
  readonly subSeries = computed(() => {
    const o = this.ov();
    return o ? [o.activeSubscribers, o.trialing, o.inGrace, o.canceled30d] : [];
  });

  ngOnInit(): void {
    if (this.canFinance()) {
      this.finance.overview().subscribe({
        next: (o) => this.ov.set(o),
        error: () => this.error.set('Could not load finance data — is the admin API running (and migrations applied)?'),
      });
      this.finance.revenue('month').subscribe({ next: (r) => this.rev.set(r), error: () => {} });
      this.finance.webhooks().subscribe({ next: (w) => this.webhooks.set(w), error: () => {} });
    }
    if (this.canGrievances()) {
      this.moderation.reports({ status: ['PENDING', 'REVIEWING'], size: 1 }).subscribe({
        next: (p) => this.openReports.set(p.totalElements),
        error: () => {},
      });
      this.moderation.reports({ status: ['PENDING', 'REVIEWING'], size: 6 }).subscribe({
        next: (p) => this.newest.set(p.content),
        error: () => {},
      });
      this.moderation.byReason().subscribe({ next: (r) => this.byReason.set(r.items), error: () => {} });
    }
    this.audit.list({ page: 0, size: 6 }).subscribe({ next: (p) => this.recent.set(p.content), error: () => {} });
  }

  money(v: number | null | undefined): string {
    if (v == null) return '—';
    return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  snippet(r: ReportSummary): string {
    return r.snippet ? r.snippet.slice(0, 44) : '(no preview)';
  }
}
