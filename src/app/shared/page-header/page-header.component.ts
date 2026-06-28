import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from '../icon';

export type HeaderTint = 'orange' | 'cyan' | 'green' | 'rose' | 'violet' | 'amber';

/**
 * Premium page header — a tinted icon tile + title (with optional count pill) +
 * subtitle, and a right-aligned actions slot. The tint draws from the design
 * system palette (reuses the global .tint-* classes) so each section gets its
 * own accent colour.
 *   <ui-page-header icon="users" title="Users" subtitle="…" [count]="n" tint="cyan">
 *     <button page-actions class="btn primary">…</button>
 *   </ui-page-header>
 */
@Component({
  selector: 'ui-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="ph">
      <div class="ph-left">
        @if (icon()) {
          <span class="ph-icon" [class]="'tint-' + tint()"><lucide-icon [name]="icon()" [size]="20" /></span>
        }
        <div class="ph-text">
          <h1 class="ph-title">
            {{ title() }}
            @if (count() !== null) { <span class="ph-count">{{ count() }}</span> }
          </h1>
          @if (subtitle()) { <p class="ph-sub">{{ subtitle() }}</p> }
        </div>
      </div>
      <div class="ph-actions"><ng-content select="[page-actions]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ph { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    .ph-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .ph-icon { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; flex: 0 0 auto; box-shadow: var(--shadow-sm); }
    .ph-text { min-width: 0; }
    .ph-title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .ph-count { font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; }
    .ph-sub { color: var(--muted-2); font-size: 12.5px; margin: 3px 0 0; }
    .ph-actions { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }
  `,
})
export class PageHeaderComponent {
  readonly icon = input('');
  readonly title = input('');
  readonly subtitle = input('');
  readonly count = input<number | null>(null);
  readonly tint = input<HeaderTint>('orange');
}
