import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { IconComponent } from './icon';

/**
 * Themed search field — magnifier + clear button + a DEBOUNCED `(search)` output
 * (distinct, default 350ms) for server-side filtering. CVA so `[(ngModel)]`
 * binds the live value too.
 *   <ui-search-bar placeholder="Search clubs…" [(ngModel)]="q" (search)="reload($event)" />
 */
@Component({
  selector: 'ui-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="sb" [class.sm]="size() === 'sm'" [class.focused]="focused()">
      <lucide-icon class="ic" name="search" [size]="size() === 'sm' ? 15 : 16" />
      <input
        class="in"
        type="text"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        (keyup.enter)="search.emit(value())"
        (keyup.escape)="clear()"
      />
      @if (value()) {
        <button type="button" class="x" (click)="clear()" aria-label="Clear search"><lucide-icon name="x" [size]="14" /></button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .sb { display: flex; align-items: center; gap: 9px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0 12px; transition: 0.18s var(--ease); }
    .sb:hover { border-color: var(--line-strong); }
    .sb.focused { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
    .sb.sm { border-radius: 9px; }
    .ic { color: var(--muted-2); flex: 0 0 auto; }
    .in { flex: 1; border: 0; background: transparent; outline: none; color: var(--ink); font-family: inherit; font-size: 14px; padding: 11px 0; }
    .sb.sm .in { padding: 7px 0; font-size: 13px; }
    .in::placeholder { color: var(--muted-2); }
    .x { border: 0; background: transparent; color: var(--muted-2); cursor: pointer; display: grid; place-items: center; padding: 3px; border-radius: 6px; flex: 0 0 auto; }
    .x:hover { color: var(--ink); background: var(--surface-3); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchBarComponent), multi: true }],
})
export class SearchBarComponent implements OnInit, OnDestroy, ControlValueAccessor {
  readonly placeholder = input('Search…');
  readonly ariaLabel = input('');
  readonly size = input<'md' | 'sm'>('md');
  readonly debounce = input(350);

  /** Debounced, distinct query — wire this to a server reload. */
  readonly search = output<string>();

  readonly value = signal('');
  readonly focused = signal(false);

  private readonly input$ = new Subject<string>();
  private sub?: { unsubscribe(): void };

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.sub = this.input$
      .pipe(debounceTime(this.debounce()), distinctUntilChanged())
      .subscribe((v) => this.search.emit(v));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
    this.input$.next(v);
  }

  clear(): void {
    this.value.set('');
    this.onChange('');
    this.onTouched();
    this.input$.next('');
    this.search.emit('');
  }

  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
