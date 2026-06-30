import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Read-only label : value grid for detail panels. Wrap `ui-def-item`s. */
@Component({
  selector: 'ui-def-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="dg"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .dg { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px 28px; }
  `,
})
export class DefGridComponent {}

/** A single label/value pair. Value is projected (so it can hold pills/links). */
@Component({
  selector: 'ui-def-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dl">{{ label() }}</span>
    <div class="dv" [class.muted]="muted()"><ng-content /></div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .dl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-2); margin-bottom: 5px; }
    .dv { font-size: 14px; color: var(--ink); line-height: 1.5; word-break: break-word; }
    .dv.muted { color: var(--muted-2); }
  `,
})
export class DefItemComponent {
  readonly label = input('');
  readonly muted = input(false);
}
