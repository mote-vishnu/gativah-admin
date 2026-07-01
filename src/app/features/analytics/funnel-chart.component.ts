import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { FunnelStep } from '../../core/models';

/**
 * Activation funnel as stacked horizontal bars. Bar width = conversion from the
 * first step; each step shows its user count and step-over-step conversion.
 */
@Component({
  selector: 'app-funnel-chart',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="funnel">
      @for (s of steps(); track s.key; let i = $index) {
        <div class="step">
          <div class="meta">
            <span class="lab">{{ s.label }}</span>
            @if (i > 0) {
              <span class="drop" [class.bad]="s.conversionFromPrev < 50">
                {{ s.conversionFromPrev | number: '1.0-0' }}% from prev
              </span>
            }
          </div>
          <div class="track">
            <div class="fill" [style.width.%]="barWidth(s)" [style.background]="color(i)">
              <span class="u">{{ s.users | number }}</span>
            </div>
            <span class="pct">{{ s.conversionFromStart | number: '1.0-0' }}%</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .funnel { display: flex; flex-direction: column; gap: 14px; }
    .step { display: flex; flex-direction: column; gap: 6px; }
    .meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .lab { font-size: 13px; font-weight: 600; color: var(--ink); }
    .drop { font-size: 11px; color: var(--muted); }
    .drop.bad { color: var(--rose); }
    .track { display: flex; align-items: center; gap: 10px; }
    .fill { height: 34px; border-radius: 9px; display: flex; align-items: center; min-width: 42px; transition: width 0.4s var(--ease); box-shadow: var(--shadow-sm); }
    .u { color: #fff; font-weight: 700; font-size: 12.5px; padding: 0 12px; font-variant-numeric: tabular-nums; }
    .pct { font-size: 12px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; width: 44px; }
  `,
})
export class FunnelChartComponent {
  readonly steps = input<FunnelStep[]>([]);

  private readonly palette = ['--brand', '--cyan', '--violet', '--green', '--amber', '--rose'];

  /** Distinct colour per funnel step (design token). */
  color(i: number): string {
    return `var(${this.palette[i % this.palette.length]})`;
  }

  /** Minimum visible width so tiny steps still render a bar. */
  barWidth(s: FunnelStep): number {
    return Math.max(4, s.conversionFromStart);
  }
}
