import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmService } from './confirm.service';

@Component({
  selector: 'ui-confirm-host',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (confirm.state(); as s) {
      <div class="overlay" (click)="confirm.cancel()">
        <div class="dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <h3>{{ s.title }}</h3>
          @if (s.message) { <p class="msg">{{ s.message }}</p> }
          @if (s.input) {
            <label class="fld">
              <span>{{ s.input.label }}</span>
              @if (s.input.multiline) {
                <textarea rows="3" [placeholder]="s.input.placeholder || ''" [(ngModel)]="value"></textarea>
              } @else {
                <input type="text" [placeholder]="s.input.placeholder || ''" [(ngModel)]="value" />
              }
            </label>
          }
          <div class="acts">
            <button class="btn" (click)="confirm.cancel()">{{ s.cancelLabel || 'Cancel' }}</button>
            <button class="btn primary" [class.danger]="s.tone === 'danger'" [disabled]="blocked()" (click)="confirm.accept(value())">
              {{ s.confirmLabel || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: grid; place-items: center; padding: 20px; animation: fade 0.14s var(--ease); }
    .dialog { width: 420px; max-width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow-lg); padding: 22px; animation: pop 0.16s var(--ease); }
    h3 { margin: 0 0 8px; font-family: var(--sans); font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .msg { margin: 0 0 16px; font-size: 13px; color: var(--muted); line-height: 1.55; }
    .fld { display: block; margin-bottom: 16px; }
    .fld span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .fld input, .fld textarea { width: 100%; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 10px 12px; color: var(--ink); font: inherit; font-size: 13px; resize: vertical; }
    .fld input:focus, .fld textarea:focus { outline: none; border-color: var(--brand-line); }
    .acts { display: flex; justify-content: flex-end; gap: 10px; }
    .btn { padding: 9px 16px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn:hover { border-color: var(--line-strong); }
    .btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
    .btn.primary.danger { background: var(--rose); border-color: var(--rose); }
    .btn:disabled { opacity: 0.5; cursor: default; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  `,
})
export class ConfirmHostComponent {
  readonly confirm = inject(ConfirmService);
  readonly value = signal('');

  readonly blocked = computed(() => {
    const s = this.confirm.state();
    return !!s?.input?.required && !this.value().trim();
  });

  constructor() {
    // Clear the captured text whenever a new dialog opens.
    effect(() => {
      if (this.confirm.state()) {
        this.value.set('');
      }
    });
  }
}
