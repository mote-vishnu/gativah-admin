import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { RetentionResponse } from '../../core/models';

/**
 * Weekly signup-cohort retention heatmap. Each cell is % of the cohort still
 * active N weeks after signup, rendered as a tinted tile (brand ramp). Future
 * (unobservable) cells are left blank.
 */
@Component({
  selector: 'app-retention-grid',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (data(); as d) {
      @if (d.cohorts.length) {
        <div class="wrap">
          <div class="rgrid" [style.gridTemplateColumns]="cols(d.weeks)">
            <div class="rh lead">Cohort</div>
            <div class="rh mid">Users</div>
            @for (w of range(d.weeks); track w) { <div class="rh">W{{ w }}</div> }

            @for (row of d.cohorts; track row.cohortWeek) {
              <div class="lead cell-label">{{ row.cohortWeek | date: 'MMM d' }}</div>
              <div class="mid"><span class="ubadge">{{ row.cohortSize }}</span></div>
              @for (p of row.retainedPct; track $index) {
                @if (p === null) {
                  <div class="tile blank"></div>
                } @else {
                  <div class="tile" [style.background]="bg(p)" [style.color]="fg(p)"
                       [title]="tip(row.cohortWeek, $index, p)">{{ round(p) }}<small>%</small></div>
                }
              }
            }
          </div>
        </div>

        <div class="legend">
          <span>Less</span>
          <i class="ramp"></i>
          <span>More retained</span>
        </div>
      } @else {
        <div class="none">No signup cohorts in this window yet.</div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .wrap { overflow-x: auto; padding-bottom: 2px; }
    .rgrid { display: grid; gap: 6px; align-items: stretch; min-width: 520px; }
    .rh { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); font-weight: 700; text-align: center; padding-bottom: 4px; }
    .rh.lead { text-align: left; } .rh.mid { text-align: center; }
    .lead { display: flex; align-items: center; }
    .mid { display: flex; align-items: center; justify-content: center; }
    .cell-label { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
    .ubadge { min-width: 26px; text-align: center; font-size: 11px; font-weight: 700; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }

    .tile { display: flex; align-items: baseline; justify-content: center; height: 42px; border-radius: 10px; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; transition: transform 0.12s var(--ease), box-shadow 0.12s var(--ease); cursor: default; }
    .tile small { font-size: 9px; opacity: 0.7; margin-left: 1px; align-self: center; }
    .tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
    .tile.blank { background: var(--surface-2); opacity: 0.35; border: 1px dashed var(--line); }
    .tile.blank:hover { transform: none; box-shadow: none; }

    .legend { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-size: 11px; color: var(--muted-2); }
    .legend .ramp { flex: 0 0 140px; height: 8px; border-radius: 999px; background: linear-gradient(90deg, rgba(249,115,22,0.1), rgba(249,115,22,0.55), rgba(249,115,22,0.95)); }
    .none { padding: 40px; text-align: center; color: var(--muted-2); font-size: 13px; }
  `,
})
export class RetentionGridComponent {
  readonly data = input<RetentionResponse | null>(null);

  cols(weeks: number): string {
    return `minmax(84px, 0.9fr) 60px repeat(${weeks}, minmax(38px, 1fr))`;
  }

  range(weeks: number): number[] {
    return Array.from({ length: weeks }, (_, i) => i);
  }

  round(pct: number): number {
    return Math.round(pct);
  }

  /** Heatmap fill: brand orange with intensity ramped by retention %. */
  bg(pct: number): string {
    const a = 0.08 + (pct / 100) * 0.84;
    return `rgba(249, 115, 22, ${a})`;
  }

  fg(pct: number): string {
    return pct >= 45 ? '#fff' : 'var(--ink)';
  }

  tip(cohortWeek: string, week: number, pct: number): string {
    return `${cohortWeek} cohort · week ${week}: ${pct}% retained`;
  }
}
