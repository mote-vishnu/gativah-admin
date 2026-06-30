import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab focus cycling inside the host (drawers / dialogs). Focuses the first
 * focusable on init and wraps Shift+Tab / Tab at the edges.
 *   <aside uiFocusTrap> … </aside>
 */
@Directive({ selector: '[uiFocusTrap]', standalone: true })
export class FocusTrapDirective implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly uiFocusTrap = input<boolean | ''>('');

  ngAfterViewInit(): void {
    if (this.uiFocusTrap() === false) { return; }
    const el = this.host.nativeElement as HTMLElement;
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Tab') { return; }
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) { return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    });
    setTimeout(() => {
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 0);
  }
}
