import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Shows a spinner and disables the host button while loading, restoring its
 * original content when done. Signal-based (reacts to the bound value).
 *   <button class="btn primary" [uiLoading]="saving()">Save</button>
 */
@Directive({ selector: '[uiLoading]', standalone: true })
export class LoadingButtonDirective {
  private readonly el = inject(ElementRef<HTMLButtonElement>);
  readonly uiLoading = input(false);

  private original = '';

  constructor() {
    effect(() => {
      const btn = this.el.nativeElement;
      if (this.uiLoading()) {
        if (!btn.classList.contains('is-loading')) {
          this.original = btn.innerHTML;
          btn.classList.add('is-loading');
          btn.setAttribute('disabled', 'true');
          btn.style.pointerEvents = 'none';
          btn.innerHTML = '<span class="ui-btn-spinner"></span>';
        }
      } else if (btn.classList.contains('is-loading')) {
        btn.classList.remove('is-loading');
        btn.removeAttribute('disabled');
        btn.style.pointerEvents = '';
        btn.innerHTML = this.original;
      }
    });
  }
}
