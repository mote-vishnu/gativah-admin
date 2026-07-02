import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Shimmer loading placeholders. Variants: table / card / stat / text / line.
 *   <ui-skeleton type="stat" [rows]="5" />
 *   <ui-skeleton type="table" [rows]="6" columns="2 1 1 1 0.5" />
 *   <ui-skeleton type="line" width="160px" height="14px" />
 */
@Component({
  selector: 'ui-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (type()) {
      @case ('table') {
        <div class="sk-table">
          @for (r of rowArr(); track r) {
            <div class="sk-row">
              @for (c of cols(); track $index) { <span class="bar shimmer" [style.flex]="c"></span> }
            </div>
          }
        </div>
      }
      @case ('card') {
        @for (r of rowArr(); track r) {
          <div class="sk-card">
            <div class="sk-chead"><span class="circ shimmer"></span><div class="lines"><span class="bar shimmer md"></span><span class="bar shimmer sm"></span></div></div>
            <span class="bar shimmer full"></span><span class="bar shimmer lg"></span>
          </div>
        }
      }
      @case ('stat') {
        <div class="sk-stats">
          @for (r of rowArr(); track r) {
            <div class="sk-stat"><span class="bar shimmer xs"></span><span class="bar shimmer val"></span><span class="bar shimmer sm"></span></div>
          }
        </div>
      }
      @case ('text') {
        <div class="sk-text">
          @for (r of rowArr(); track r; let last = $last) { <span class="bar shimmer" [style.width]="last ? '60%' : '100%'"></span> }
        </div>
      }
      @case ('line') {
        <span class="bar shimmer" [style.width]="width() || '100%'" [style.height]="height() || '16px'"></span>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .bar { display: block; height: 12px; border-radius: 6px; background: var(--surface-3); }
    .shimmer { position: relative; overflow: hidden; }
    .shimmer::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ink) 8%, transparent) 45%, color-mix(in srgb, var(--brand) 10%, transparent) 55%, transparent);
      animation: sk 1.35s var(--ease) infinite; }
    @keyframes sk { 100% { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .shimmer::after { animation: none; opacity: 0.4; transform: none; } }

    .sk-table { display: flex; flex-direction: column; gap: 14px; padding: 8px 2px; }
    .sk-row { display: flex; gap: 16px; }
    .sk-card { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 18px; margin-bottom: 14px; }
    .sk-chead { display: flex; gap: 12px; margin-bottom: 14px; }
    .circ { width: 42px; height: 42px; border-radius: 12px; background: var(--surface-3); flex: 0 0 auto; }
    .lines { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
    .sk-card .full { margin-top: 10px; } .sk-card .lg { width: 80%; margin-top: 8px; }
    .md { width: 50%; } .sm { width: 30%; } .xs { width: 40%; height: 10px; } .lg { width: 70%; }
    .sk-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
    .sk-stat { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .sk-stat .val { height: 26px; width: 60%; }
    .sk-text { display: flex; flex-direction: column; gap: 9px; }
  `,
})
export class SkeletonComponent {
  readonly type = input<'table' | 'card' | 'stat' | 'text' | 'line'>('table');
  readonly rows = input(5);
  /** Flex ratios for table columns, space-separated. */
  readonly columns = input('2 1 1 1 0.5');
  readonly width = input('');
  readonly height = input('');

  readonly rowArr = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  readonly cols = computed(() => this.columns().trim().split(/\s+/));
}
