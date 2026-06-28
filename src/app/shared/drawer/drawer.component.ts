import { ChangeDetectionStrategy, Component, HostListener, booleanAttribute, input, output } from '@angular/core';

import { IconComponent } from '../icon';

/**
 * Right-side slide-in drawer with a dimmed backdrop. Parent controls visibility
 * via [open] and reacts to (closed) (backdrop click / Esc / close button).
 *   <ui-drawer [open]="!!editor()" title="Edit role" (closed)="cancel()">
 *     …body…
 *     <div drawer-footer>…actions…</div>
 *   </ui-drawer>
 */
@Component({
  selector: 'ui-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <aside class="panel" [style.width.px]="width()" role="dialog" aria-modal="true">
        <header class="dh">
          <h3>{{ title() }}</h3>
          <button class="x" (click)="closed.emit()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>
        <div class="body"><ng-content /></div>
        <footer class="df"><ng-content select="[drawer-footer]" /></footer>
      </aside>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 60; animation: fade 0.15s var(--ease); }
    .panel {
      position: fixed; top: 0; right: 0; bottom: 0; max-width: 100vw; z-index: 61;
      background: var(--surface); border-left: 1px solid var(--line); box-shadow: var(--shadow);
      display: flex; flex-direction: column; animation: slide 0.2s var(--ease);
    }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide { from { transform: translateX(100%); } to { transform: none; } }
    .dh { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px; border-bottom: 1px solid var(--line); }
    .dh h3 { font-family: var(--sans); font-weight: 700; font-size: 16px; margin: 0; }
    .x { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); display: grid; place-items: center; cursor: pointer; transition: 0.15s var(--ease); }
    .x:hover { color: var(--ink); border-color: var(--line-strong); }
    .body { flex: 1; overflow-y: auto; padding: 20px 22px; }
    .df { padding: 16px 22px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 9px; }
    .df:empty { display: none; }
  `,
})
export class DrawerComponent {
  readonly open = input(false, { transform: booleanAttribute });
  readonly title = input('');
  readonly width = input(480);

  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
