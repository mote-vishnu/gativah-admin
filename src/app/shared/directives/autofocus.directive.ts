import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Focuses the host element after the view initialises (next tick, so it works
 * inside freshly-opened drawers / dialogs). Pass a falsy value to skip.
 *   <input uiAutofocus />
 *   <input [uiAutofocus]="shouldFocus" />
 */
@Directive({ selector: '[uiAutofocus]', standalone: true })
export class AutofocusDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly uiAutofocus = input<boolean | ''>('');

  ngAfterViewInit(): void {
    if (this.uiAutofocus() === false) { return; }
    setTimeout(() => this.el.nativeElement.focus(), 0);
  }
}
