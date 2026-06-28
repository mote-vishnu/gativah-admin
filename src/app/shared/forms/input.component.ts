import { ChangeDetectionStrategy, Component, computed, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let uid = 0;

/**
 * Themed text input with label / hint / error. Implements ControlValueAccessor
 * so it drops in with `[(ngModel)]` (or reactive forms) exactly like a native input.
 *   <ui-input label="Email" type="email" [(ngModel)]="email" />
 */
@Component({
  selector: 'ui-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <input
      [id]="id"
      class="input"
      [class.invalid]="!!error()"
      [type]="type()"
      [attr.placeholder]="placeholder() || null"
      [attr.maxlength]="maxlength() ?? null"
      [attr.inputmode]="inputmode() || null"
      [attr.autocomplete]="autocomplete() || null"
      [disabled]="isDisabled()"
      [value]="value()"
      (input)="write($event)"
      (blur)="onTouched()"
      (keyup.enter)="enter.emit()"
    />
    @if (error()) { <span class="msg err">{{ error() }}</span> }
    @else if (hint()) { <span class="msg hint">{{ hint() }}</span> }
  `,
  styles: `
    :host { display: block; }
    :host(.code) .input { font-family: var(--mono); font-size: 22px; text-align: center; letter-spacing: 0.3em; }
    .input.invalid { border-color: rgba(251, 113, 133, 0.55); }
    .input.invalid:focus { box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.16); }
    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputComponent), multi: true }],
})
export class InputComponent implements ControlValueAccessor {
  readonly id = `ui-input-${uid++}`;

  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url' | 'date' | 'datetime-local'>('text');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly maxlength = input<number | null>(null);
  readonly inputmode = input('');
  readonly autocomplete = input('');
  readonly disabled = input(false);

  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  /** Fired on Enter, for inline submit flows. */
  readonly enter = output<void>();

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  write(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  writeValue(v: string | number | null): void {
    this.value.set(v == null ? '' : String(v));
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}
