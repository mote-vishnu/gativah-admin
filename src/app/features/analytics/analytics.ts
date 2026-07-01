import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { IconComponent } from '../../shared/icon';
import { PageHeaderComponent } from '../../shared/page-header';
import { ChartComponent } from '../../shared/chart/chart.component';
import { WorldMapComponent } from '../../shared/worldmap/worldmap.component';
import { AnalyticsApi } from '../../core/analytics.api';
import {
  ActiveUsersResponse,
  EngagementResponse,
  EventBreakdownResponse,
  FunnelResponse,
  GeoResponse,
  OverviewKpis,
  PlatformResponse,
  RetentionResponse,
} from '../../core/models';
import { FunnelChartComponent } from './funnel-chart.component';
import { RetentionGridComponent } from './retention-grid.component';

interface Range { days: number; label: string; }
const RANGES: Range[] = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

const EVENT_LABELS: Record<string, string> = {
  app_open: 'App open', screen_view: 'Screen view', workout_viewed: 'Workout viewed',
  workout_started: 'Workout started', workout_completed: 'Workout completed', exercise_searched: 'Exercise search',
  plan_activated: 'Plan activated', plan_deactivated: 'Plan deactivated', programme_enrolled: 'Programme enrolled',
  formcheck_started: 'Form-check started',
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [DecimalPipe, IconComponent, PageHeaderComponent, ChartComponent, WorldMapComponent, FunnelChartComponent, RetentionGridComponent],
  template: `
    <ui-page-header icon="chart-line" title="Insights" subtitle="Product analytics · engagement, retention & activation" tint="violet">
      <div page-actions class="ranges">
        @for (r of ranges; track r.days) {
          <button class="chip" [class.on]="range() === r.days" (click)="setRange(r.days)">{{ r.label }}</button>
        }
      </div>
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (overview(); as o) {
      <div class="row g4" style="margin-bottom:14px">
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="activity" [size]="16" /></span> DAU</div><div class="val c-orange">{{ o.dau | number }}</div><div class="delta flat">daily active</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="users" [size]="16" /></span> WAU</div><div class="val c-cyan">{{ o.wau | number }}</div><div class="delta flat">7-day active</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="users-round" [size]="16" /></span> MAU</div><div class="val c-violet">{{ o.mau | number }}</div><div class="delta flat">30-day active</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="chart-line" [size]="16" /></span> Stickiness</div><div class="val c-green">{{ o.stickiness }}%</div><div class="delta flat">DAU / MAU</div></div>
      </div>
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="users" [size]="16" /></span> Active users</div><div class="val c-cyan">{{ o.activeUsers | number }}</div><div class="delta" [class]="deltaCls(o.activeUsersDelta)"><lucide-icon [name]="deltaIcon(o.activeUsersDelta)" [size]="12" /> {{ abs(o.activeUsersDelta) }}%</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="user-plus" [size]="16" /></span> New signups</div><div class="val c-orange">{{ o.newSignups | number }}</div><div class="delta" [class]="deltaCls(o.newSignupsDelta)"><lucide-icon [name]="deltaIcon(o.newSignupsDelta)" [size]="12" /> {{ abs(o.newSignupsDelta) }}%</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="bar-chart-3" [size]="16" /></span> Total events</div><div class="val c-violet">{{ o.totalEvents | number }}</div><div class="delta" [class]="deltaCls(o.totalEventsDelta)"><lucide-icon [name]="deltaIcon(o.totalEventsDelta)" [size]="12" /> {{ abs(o.totalEventsDelta) }}%</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="activity" [size]="16" /></span> Events / user</div><div class="val c-green">{{ o.avgEventsPerUser }}</div><div class="delta flat">avg in period</div></div>
      </div>
    }

    <div class="grid2">
      <div class="card">
        <div class="card-h"><h3>Active users & signups</h3><span class="hint">daily · last {{ range() }} days</span></div>
        <ui-chart type="area" [series]="activeSeries()" [categories]="activeCats()" [colors]="['--brand', '--cyan']" [height]="290" />
      </div>
      <div class="card">
        <div class="card-h"><h3>Stickiness</h3><span class="hint">DAU / 30-day MAU · %</span></div>
        <ui-chart type="line" [series]="stickSeries()" [categories]="stickCats()" [colors]="['--green']" [height]="290" />
      </div>
    </div>

    <div class="grid2" style="margin-top:18px">
      <div class="card">
        <div class="card-h"><h3>Event breakdown</h3><span class="hint">{{ (eventsData()?.total ?? 0) | number }} events</span></div>
        @if (eventsData()?.events?.length) {
          <ui-chart type="bar" [series]="eventSeries()" [categories]="eventCats()" [colors]="eventPalette" [options]="hBarOpts" [height]="eventHeight()" />
        } @else { <div class="empty">No events in this window.</div> }
      </div>
      <div class="card">
        <div class="card-h"><h3>Platforms</h3><span class="hint">event share</span></div>
        @if (platformData()?.platforms?.length) {
          <ui-chart type="donut" [series]="platformSeries()" [colors]="['--brand', '--cyan', '--violet', '--green']" [options]="donutOpts()" [height]="250" />
          <div class="vtable">
            @for (v of platformData()!.versions; track v.appVersion) {
              <div class="vrow"><span class="mono">{{ v.appVersion }}</span><span class="vc">{{ v.users | number }} users · {{ v.events | number }} ev</span></div>
            }
          </div>
        } @else { <div class="empty">No platform data.</div> }
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-h"><h3>Activation funnel</h3><span class="hint">distinct users · last {{ range() }} days</span></div>
      <app-funnel-chart [steps]="funnelData()?.steps ?? []" />
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-h">
        <h3>Users by geography</h3>
        <span class="hint">@if (geo(); as g) { {{ g.mappedUsers | number }} of {{ g.totalUsers | number }} located · {{ g.countries.length }} countries }</span>
      </div>
      @if (geo()?.countries?.length) {
        <div class="geowrap">
          <ui-worldmap [data]="geo()!.countries" [height]="440" />
          <div class="toplist">
            <div class="tl-h">Top countries</div>
            @for (c of topCountries(); track c.code) {
              <div class="crow">
                <span class="cc">{{ flag(c.code) }}</span>
                <span class="cn">{{ c.name }}</span>
                <div class="cbar"><i [style.width.%]="barPct(c.users)"></i></div>
                <b>{{ c.users }}</b>
              </div>
            }
          </div>
        </div>
      } @else { <div class="empty">No user location data yet.</div> }
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-h"><h3>Retention</h3><span class="hint">weekly signup cohorts · % still active</span></div>
      <app-retention-grid [data]="retentionData()" />
    </div>
  `,
  styles: `
    .ranges { display: inline-flex; gap: 6px; }
    .chip { border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font: inherit; font-size: 12px; font-weight: 700; padding: 6px 13px; border-radius: 999px; cursor: pointer; transition: 0.15s var(--ease); }
    .chip:hover { color: var(--ink); }
    .chip.on { border-color: var(--brand-line); background: var(--brand-soft); color: var(--brand); }
    .kpi .val.c-orange { color: var(--brand); } .kpi .val.c-cyan { color: var(--cyan); } .kpi .val.c-violet { color: var(--violet); } .kpi .val.c-green { color: var(--green); }
    .delta.up { color: var(--green); } .delta.down { color: var(--rose); }
    .delta { display: inline-flex; align-items: center; gap: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    @media (max-width: 1080px) { .grid2 { grid-template-columns: 1fr; } }
    .empty { padding: 60px 20px; text-align: center; color: var(--muted-2); font-size: 13px; }
    .vtable { margin-top: 14px; border-top: 1px solid var(--line-soft); padding-top: 10px; display: flex; flex-direction: column; gap: 2px; }
    .vrow { display: flex; justify-content: space-between; gap: 12px; font-size: 11.5px; padding: 4px 2px; }
    .vrow .mono { font-family: var(--mono); color: var(--ink-2); }
    .vrow .vc { color: var(--muted-2); }
    .geowrap { display: grid; grid-template-columns: 1fr 290px; gap: 22px; align-items: start; }
    @media (max-width: 1000px) { .geowrap { grid-template-columns: 1fr; } }
    .toplist { border-left: 1px solid var(--line-soft); padding-left: 20px; }
    @media (max-width: 1000px) { .toplist { border-left: 0; padding-left: 0; } }
    .tl-h { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); font-weight: 700; margin-bottom: 12px; }
    .crow { display: flex; align-items: center; gap: 11px; padding: 8px 0; font-size: 13px; }
    .crow .cc { font-size: 17px; line-height: 1; flex: 0 0 auto; }
    .crow .cn { flex: 0 0 92px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .crow .cbar { flex: 1; height: 6px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
    .crow .cbar i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--brand-3), var(--brand)); }
    .crow b { width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class AnalyticsComponent implements OnInit {
  private readonly api = inject(AnalyticsApi);

  readonly range = signal(30);
  readonly ranges = RANGES;
  readonly error = signal<string | null>(null);

  readonly overview = signal<OverviewKpis | null>(null);
  readonly active = signal<ActiveUsersResponse | null>(null);
  readonly engagement = signal<EngagementResponse | null>(null);
  readonly eventsData = signal<EventBreakdownResponse | null>(null);
  readonly platformData = signal<PlatformResponse | null>(null);
  readonly funnelData = signal<FunnelResponse | null>(null);
  readonly retentionData = signal<RetentionResponse | null>(null);
  readonly geo = signal<GeoResponse | null>(null);

  readonly topCountries = computed(() => (this.geo()?.countries ?? []).slice(0, 8));

  /** Shared multi-colour palette (design tokens) for per-bar distributed charts. */
  readonly palette = ['--brand', '--cyan', '--violet', '--green', '--amber', '--rose'];
  /** 10 well-separated hues so every event name gets a unique bar colour (only 6 theme tokens exist). */
  readonly eventPalette = ['#f97316', '#06b6d4', '#8b5cf6', '#22c55e', '#eab308', '#f43f5e', '#3b82f6', '#ec4899', '#14b8a6', '#84cc16'];
  readonly hBarOpts = {
    plotOptions: { bar: { horizontal: true, borderRadius: 5, distributed: true } },
    legend: { show: false },
  };

  // ── chart adapters ───────────────────────────────────────────
  readonly activeSeries = computed(() => {
    const a = this.active();
    return [
      { name: 'Active users', data: (a?.activeUsers ?? []).map((p) => p.value) },
      { name: 'New signups', data: (a?.newSignups ?? []).map((p) => p.value) },
    ];
  });
  readonly activeCats = computed(() => (this.active()?.activeUsers ?? []).map((p) => this.shortDate(p.date)));

  readonly stickSeries = computed(() => [{ name: 'Stickiness %', data: (this.engagement()?.series ?? []).map((p) => p.stickiness) }]);
  readonly stickCats = computed(() => (this.engagement()?.series ?? []).map((p) => this.shortDate(p.date)));

  readonly eventSeries = computed(() => [{ name: 'Events', data: (this.eventsData()?.events ?? []).map((e) => e.count) }]);
  readonly eventCats = computed(() => (this.eventsData()?.events ?? []).map((e) => EVENT_LABELS[e.name] ?? e.name));
  readonly eventHeight = computed(() => Math.max(220, (this.eventsData()?.events?.length ?? 0) * 34 + 40));

  readonly platformSeries = computed(() => (this.platformData()?.platforms ?? []).map((p) => p.events));
  readonly donutOpts = computed(() => ({
    labels: (this.platformData()?.platforms ?? []).map((p) => this.titleCase(p.platform)),
    legend: { position: 'bottom' },
  }));

  ngOnInit(): void {
    this.load();
    // Geography isn't range-scoped — load once.
    this.api.geo().subscribe({ next: (g) => this.geo.set(g), error: () => {} });
  }

  /** Top-country bar width relative to the busiest country. */
  barPct(users: number): number {
    const max = this.topCountries()[0]?.users ?? 1;
    return max > 0 ? Math.round((users / max) * 100) : 0;
  }

  /** ISO alpha-2 → emoji flag (regional-indicator pair). */
  flag(code: string): string {
    if (!code || code.length !== 2) { return '🏳️'; }
    const base = 0x1f1e6;
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
  }

  setRange(days: number): void {
    if (this.range() === days) { return; }
    this.range.set(days);
    this.load();
  }

  private load(): void {
    const d = this.range();
    this.api.overview(d).subscribe({ next: (r) => this.overview.set(r), error: () => this.error.set('Could not load analytics (needs ANALYTICS:VIEW).') });
    this.api.activeUsers(d).subscribe({ next: (r) => this.active.set(r), error: () => {} });
    this.api.engagement(d).subscribe({ next: (r) => this.engagement.set(r), error: () => {} });
    this.api.events(d).subscribe({ next: (r) => this.eventsData.set(r), error: () => {} });
    this.api.platforms(d).subscribe({ next: (r) => this.platformData.set(r), error: () => {} });
    this.api.funnel(d).subscribe({ next: (r) => this.funnelData.set(r), error: () => {} });
    this.api.retention(8).subscribe({ next: (r) => this.retentionData.set(r), error: () => {} });
  }

  abs(n: number): number { return Math.abs(n); }
  deltaCls(n: number): string { return n >= 0 ? 'up' : 'down'; }
  deltaIcon(n: number): string { return n >= 0 ? 'trending-up' : 'trending-down'; }

  private shortDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private titleCase(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
}
