import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Themed multi-line input. <ui-textarea label="Notes" [rows]="3" [(ngModel)]="notes" /> */
@Component({
  selector: 'ui-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <textarea
      [id]="id"
      class="input"
      [class.invalid]="!!error()"
      [rows]="rows()"
      [attr.placeholder]="placeholder() || null"
      [attr.maxlength]="maxlength() ?? null"
      [disabled]="isDisabled()"
      [value]="value()"
      (input)="write($event)"
      (blur)="onTouched()"
    ></textarea>
    @if (error()) { <span class="msg err">{{ error() }}</span> }
    @else if (hint()) { <span class="msg hint">{{ hint() }}</span> }
  `,
  styles: `
    :host { display: block; }
    textarea.input { resize: vertical; min-height: 64px; line-height: 1.5; }
    .input.invalid { border-color: rgba(251, 113, 133, 0.55); }
    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextareaComponent), multi: true }],
})
export class TextareaComponent implements ControlValueAccessor {
  private static seq = 0;
  readonly id = `ui-textarea-${TextareaComponent.seq++}`;

  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly rows = input(3);
  readonly maxlength = input<number | null>(null);
  readonly disabled = input(false);

  readonly value = signal('');
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  write(event: Event): void {
    const v = (event.target as HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}
