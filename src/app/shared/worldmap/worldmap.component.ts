import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, input, viewChild } from '@angular/core';
import jsVectorMap from 'jsvectormap';

import { ThemeService } from '../../core/theme.service';
import { CountryStat } from '../../core/models';

// jsvectormap's map data files register onto a global `jsVectorMap`; expose it,
// then load the world map once (dynamic import so the global is set first).
(globalThis as unknown as { jsVectorMap: unknown }).jsVectorMap = jsVectorMap;
const mapReady: Promise<unknown> = import('jsvectormap/dist/maps/world.js').catch(() => null);

/**
 * World choropleth of users by country using jsVectorMap (MIT — no licence or
 * attribution). Isolated behind our own component like ui-chart: countries with
 * users are shaded on a brand ramp, the rest stay neutral. Rebuilds on data or
 * theme change.
 *
 *   <ui-worldmap [data]="countries()" [height]="440" />
 */
@Component({
  selector: 'ui-worldmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #el [style.height.px]="height()"></div>`,
  styles: `
    :host { display: block; }
    div { width: 100%; }
    :host ::ng-deep .jvm-tooltip { background: var(--ink); color: var(--surface); border: 0; border-radius: 8px; box-shadow: var(--shadow); font-family: var(--sans); font-size: 12px; font-weight: 600; padding: 6px 10px; }
  `,
})
export class WorldMapComponent implements OnDestroy {
  private readonly el = viewChild<ElementRef<HTMLDivElement>>('el');
  private readonly theme = inject(ThemeService);

  readonly data = input<CountryStat[]>([]);
  readonly height = input<number>(440);

  private map: { destroy(): void } | null = null;

  constructor() {
    effect(() => {
      this.data(); this.height(); this.theme.theme();
      const host = this.el()?.nativeElement;
      if (host) { void mapReady.then(() => this.rebuild(host)); }
    });
  }

  private rebuild(host: HTMLElement): void {
    this.destroy();
    host.innerHTML = '';
    const byCode: Record<string, CountryStat> = {};
    const values: Record<string, number> = {};
    for (const c of this.data()) {
      byCode[c.code] = c;
      values[c.code] = c.users;
    }

    const brand = this.token('--brand') || '#f97316';
    const light = this.mix(brand, '#ffffff', 0.82);
    const base = this.token('--surface-3') || '#e4e4e7';
    const stroke = this.token('--line') || '#d4d4d8';

    try {
      this.map = new jsVectorMap({
        selector: host,
        map: 'world',
        zoomButtons: false,
        zoomOnScroll: false,
        backgroundColor: 'transparent',
        regionStyle: {
          initial: { fill: base, stroke, strokeWidth: 0.4, fillOpacity: 1 },
          hover: { fillOpacity: 0.85 },
        },
        series: {
          regions: [{
            attribute: 'fill',
            scale: [light, brand],
            normalizeFunction: 'polynomial',
            values,
          }],
        },
        onRegionTooltipShow: (_event: unknown, tooltip: { text(v: string): void }, code: string) => {
          const s = byCode[code];
          if (s) {
            tooltip.text(`${s.name}: ${s.users} user${s.users === 1 ? '' : 's'} (${s.pct}%)`);
          }
        },
      }) as unknown as { destroy(): void };
    } catch (e) {
      console.error('[ui-worldmap] render failed', e);
    }
  }

  private token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Blend two hex colours (t = weight toward `b`). Falls back to `a` if unparsable. */
  private mix(a: string, b: string, t: number): string {
    const pa = this.hex(a);
    const pb = this.hex(b);
    if (!pa || !pb) { return a; }
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private hex(c: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    if (!m) { return null; }
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  private destroy(): void {
    this.map?.destroy();
    this.map = null;
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
