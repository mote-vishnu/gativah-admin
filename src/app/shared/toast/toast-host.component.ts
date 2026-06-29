import { Component, inject } from '@angular/core';

import { IconComponent } from '../icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'ui-toast-host',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="stack">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.tone">
          <span class="ic">
            <lucide-icon [name]="icon(t.tone)" [size]="16" />
          </span>
          <span class="msg">{{ t.message }}</span>
          @if (t.action) {
            <button class="act" (click)="t.action!.run(); toast.dismiss(t.id)">{{ t.action.label }}</button>
          }
          <button class="x" (click)="toast.dismiss(t.id)" title="Dismiss"><lucide-icon name="x" [size]="14" /></button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; right: 22px; bottom: 22px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; max-width: 380px; }
    .toast { display: flex; align-items: center; gap: 11px; padding: 12px 14px; border-radius: 13px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); font-size: 13px; animation: slide-in 0.18s var(--ease); }
    .toast .ic { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; flex: 0 0 auto; }
    .toast .msg { flex: 1; min-width: 0; color: var(--ink); line-height: 1.4; }
    .toast .act { border: 0; background: transparent; color: var(--brand); font-weight: 700; font-size: 12.5px; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .toast .x { border: 0; background: transparent; color: var(--muted-2); cursor: pointer; display: grid; place-items: center; flex: 0 0 auto; }
    .toast .x:hover { color: var(--ink); }
    .toast.success .ic { background: rgba(74,222,128,0.15); color: var(--green); }
    .toast.error .ic { background: rgba(244,63,94,0.15); color: var(--rose); }
    .toast.warn .ic { background: rgba(251,191,36,0.15); color: var(--amber); }
    .toast.info .ic { background: var(--surface-2); color: var(--brand); }
    @keyframes slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `,
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);

  icon(tone: string): string {
    switch (tone) {
      case 'success': return 'check';
      case 'error': return 'ban';
      case 'warn': return 'triangle-alert';
      default: return 'bell';
    }
  }
}
