import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, input, viewChild } from '@angular/core';
import ApexCharts from 'apexcharts';

import { ThemeService } from '../../core/theme.service';

export type ChartType = 'area' | 'bar' | 'line' | 'donut' | 'radialBar' | 'pie';

/**
 * Thin wrapper around the vanilla ApexCharts library (no ng-apexcharts → no Angular
 * peer-dep risk, same approach as our icon component). Builds a themed base config
 * from our CSS design tokens (ember palette, both themes) and merges caller options.
 * Re-renders when inputs OR the theme change.
 *
 *   <ui-chart type="area" [series]="series()" [categories]="cats()" [height]="280" />
 */
@Component({
  selector: 'ui-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #el></div>`,
  styles: `:host { display: block; } :host ::ng-deep .apexcharts-tooltip { border: 0 !important; box-shadow: var(--shadow) !important; }`,
})
export class ChartComponent implements OnDestroy {
  private readonly el = viewChild<ElementRef<HTMLDivElement>>('el');
  private readonly theme = inject(ThemeService);

  readonly type = input.required<ChartType>();
  readonly series = input<unknown>([]);
  readonly categories = input<(string | number)[]>([]);
  readonly colors = input<string[]>([]);
  readonly height = input<number>(300);
  /** Extra ApexCharts options, deep-merged over the themed base. */
  readonly options = input<Record<string, unknown>>({});

  private chart: ApexCharts | null = null;

  constructor() {
    effect(() => {
      // Track every input + the theme so the chart rebuilds on any change.
      this.type(); this.series(); this.categories(); this.colors();
      this.height(); this.options(); this.theme.theme();
      const host = this.el()?.nativeElement;
      if (host) {
        this.rebuild(host);
      }
    });
  }

  private rebuild(host: HTMLElement): void {
    this.destroy();
    try {
      this.chart = new ApexCharts(host, this.build());
      void this.chart.render();
    } catch (e) {
      // A chart failure must never blank the host route.
      console.error('[ui-chart] render failed', e);
    }
  }

  private build(): Record<string, unknown> {
    const t = this.token.bind(this);
    const ink2 = t('--ink-2');
    const muted = t('--muted-2');
    const line = t('--line-soft');
    const isBar = this.type() === 'bar';
    const isRadial = this.type() === 'donut' || this.type() === 'pie' || this.type() === 'radialBar';

    const base: Record<string, unknown> = {
      chart: {
        type: this.type(),
        height: this.height(),
        fontFamily: 'Inter, sans-serif',
        background: 'transparent',
        toolbar: { show: false },
        zoom: { enabled: false },
        parentHeightOffset: 0,
        animations: { enabled: true, speed: 400 },
      },
      series: this.series(),
      colors: this.colors().length
        ? this.colors().map((c) => (c.startsWith('--') ? t(c) : c))
        : [t('--brand'), t('--cyan'), t('--violet')],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: isBar ? 0 : 2.5, lineCap: 'round' },
      grid: {
        borderColor: line,
        strokeDashArray: 4,
        padding: { left: 8, right: 8 },
        xaxis: { lines: { show: false } },
      },
      xaxis: {
        categories: this.categories(),
        labels: { style: { colors: muted, fontSize: '11px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { style: { colors: muted, fontSize: '11px' } } },
      legend: { labels: { colors: ink2 }, fontSize: '12px', markers: { radius: 12 } },
      tooltip: { theme: this.theme.theme(), style: { fontSize: '12px' } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      fill: this.type() === 'area'
        ? { type: 'gradient', gradient: { shadeIntensity: 0.3, opacityFrom: 0.35, opacityTo: 0.04, stops: [0, 95] } }
        : { opacity: 1 },
    };

    if (isRadial) {
      delete base['grid'];
      delete base['xaxis'];
      delete base['yaxis'];
    }

    return deepMerge(base, this.options());
  }

  private token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  private destroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k] as Record<string, unknown>, v) : v;
  }
  return out;
}
