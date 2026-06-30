import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../icon';

type Tone = 'error' | 'warning' | 'info' | 'success';

/**
 * Inline status banner — replaces ad-hoc `.note` divs so error/warn/info/success
 * messaging stays consistent. Optional retry / dismiss actions.
 *   <ui-error-banner [message]="error()" (retry)="reload()" />
 *   <ui-error-banner tone="success" message="Saved" dismissible (dismiss)="…" />
 */
@Component({
  selector: 'ui-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (message()) {
      <div class="banner" [class]="tone()">
        <lucide-icon class="lead" [name]="iconName()" [size]="16" />
        <span class="txt">{{ message() }}</span>
        @if (retryLabel()) { <button type="button" class="act" (click)="retry.emit()">{{ retryLabel() }}</button> }
        @if (dismissible()) { <button type="button" class="x" (click)="dismiss.emit()" aria-label="Dismiss">✕</button> }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .banner { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: var(--r-sm); font-size: 13px; margin-bottom: 16px; border: 1px solid; }
    .lead { flex: 0 0 auto; }
    .txt { flex: 1; line-height: 1.45; }
    .act { border: 0; background: transparent; font: inherit; font-weight: 600; cursor: pointer; color: inherit; text-decoration: underline; padding: 2px 4px; }
    .x { border: 0; background: transparent; color: inherit; opacity: 0.7; cursor: pointer; font-size: 12px; padding: 2px 4px; }
    .x:hover { opacity: 1; }
    .error { color: var(--rose); background: rgba(244, 63, 94, 0.09); border-color: rgba(244, 63, 94, 0.26); }
    .warning { color: var(--amber); background: rgba(251, 191, 36, 0.09); border-color: rgba(251, 191, 36, 0.26); }
    .info { color: var(--brand); background: var(--brand-soft); border-color: var(--brand-line); }
    .success { color: var(--green); background: rgba(74, 222, 128, 0.09); border-color: rgba(74, 222, 128, 0.26); }
  `,
})
export class ErrorBannerComponent {
  readonly message = input('');
  readonly tone = input<Tone>('error');
  readonly retryLabel = input('');
  readonly dismissible = input(false);

  readonly retry = output<void>();
  readonly dismiss = output<void>();

  readonly iconName = computed(() => {
    switch (this.tone()) {
      case 'success': return 'check';
      case 'info': return 'bell';
      default: return 'triangle-alert';
    }
  });
}
