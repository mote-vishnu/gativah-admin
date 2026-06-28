import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon';

/**
 * Themed checkbox with an ember check. Label is projected. Works two ways:
 *  - Form control:  <ui-checkbox [(ngModel)]="agree">Accept terms</ui-checkbox>
 *  - Controlled:    <ui-checkbox [checked]="set.has(id)" (checkedChange)="toggle(id)">Role</ui-checkbox>
 */
@Component({
  selector: 'ui-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <label class="cb" [class.disabled]="isDisabled()">
      <input
        type="checkbox"
        [checked]="state()"
        [disabled]="isDisabled()"
        (change)="toggle($event)"
        (blur)="onTouched()"
      />
      <span class="box"><lucide-icon name="check" [size]="13" /></span>
      <span class="lab"><ng-content /></span>
    </label>
  `,
  styles: `
    :host { display: inline-flex; }
    .cb { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font-size: 13px; user-select: none; }
    .cb.disabled { opacity: 0.5; cursor: not-allowed; }
    input { position: absolute; opacity: 0; width: 0; height: 0; }
    .box {
      width: 18px; height: 18px; border-radius: 6px; border: 1px solid var(--line-strong);
      background: var(--surface-2); display: grid; place-items: center; flex: 0 0 auto;
      color: transparent; transition: 0.15s var(--ease);
    }
    .cb:hover .box { border-color: var(--brand-line); }
    input:focus-visible + .box { box-shadow: 0 0 0 3px var(--brand-soft); border-color: var(--brand-line); }
    input:checked + .box {
      background: linear-gradient(135deg, var(--brand), var(--brand-3));
      border-color: transparent; color: #fff;
    }
    .lab:empty { display: none; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CheckboxComponent), multi: true }],
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();

  /** Single source of truth, driven by the `checked` input, writeValue, or a click. */
  readonly state = signal(false);
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  private onChange: (v: boolean) => void = () => {};
  onTouched: () => void = () => {};
  /** True once Angular wires this as a form control (ngModel/formControl). */
  private formBound = false;

  constructor() {
    // Mirror the controlled [checked] input into state — but never when a form
    // binding owns the value (writeValue is the source of truth then).
    effect(() => {
      const v = this.checked();
      if (!this.formBound) { this.state.set(v); }
    });
  }

  toggle(event: Event): void {
    const v = (event.target as HTMLInputElement).checked;
    this.state.set(v);
    this.onChange(v);
    this.checkedChange.emit(v);
  }

  writeValue(v: boolean): void { this.state.set(!!v); }
  registerOnChange(fn: (v: boolean) => void): void { this.onChange = fn; this.formBound = true; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}
