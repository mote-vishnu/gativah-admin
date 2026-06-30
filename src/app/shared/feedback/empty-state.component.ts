import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon';

/**
 * Centered empty / zero-state with a tinted lucide icon, title, optional body
 * and an optional CTA. Use on non-table screens (ui-table already has its own
 * inline empty state).
 *   <ui-empty-state icon="users-round" title="No clubs yet" body="…" ctaLabel="Create" (cta)="…" />
 */
@Component({
  selector: 'ui-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="es">
      <span class="ic tint-{{ tint() }}"><lucide-icon [name]="icon()" [size]="24" /></span>
      <h3>{{ title() }}</h3>
      @if (body()) { <p>{{ body() }}</p> }
      @if (ctaLabel()) {
        <button type="button" class="btn primary" (click)="cta.emit()">{{ ctaLabel() }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .es { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 56px 24px; }
    .ic { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; margin-bottom: 4px; }
    h3 { font-family: var(--sans); font-weight: 700; font-size: 16px; margin: 0; letter-spacing: -0.01em; }
    p { color: var(--muted-2); font-size: 13px; margin: 0; max-width: 360px; line-height: 1.6; }
    .btn { margin-top: 8px; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('search');
  readonly title = input('Nothing here yet');
  readonly body = input('');
  readonly ctaLabel = input('');
  /** Icon tile tint — orange/cyan/green/rose/violet/amber. */
  readonly tint = input<'orange' | 'cyan' | 'green' | 'rose' | 'violet' | 'amber'>('cyan');

  readonly cta = output<void>();
}
