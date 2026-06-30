import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

import { DateComponent } from './date.component';

export interface DateRange {
  from: string | null; // yyyy-MM-dd
  to: string | null;
}

/**
 * Themed from/to date range built from two custom {@link DateComponent}s (no
 * native date popups). CVA so it works with `[(ngModel)]`:
 *   <ui-date-range [(ngModel)]="range" (rangeChange)="reload()" />
 * Value is { from, to } (ISO yyyy-MM-dd or null).
 */
@Component({
  selector: 'ui-date-range',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DateComponent],
  template: `
    <div class="range">
      <ui-date class="f" placeholder="From" [clearable]="false" [disabled]="disabled()"
               [max]="to() || ''" [ngModel]="from()" (valueChange)="set('from', $event)" />
      <span class="dash">→</span>
      <ui-date class="f" placeholder="To" [clearable]="false" [disabled]="disabled()"
               [min]="from() || ''" [ngModel]="to()" (valueChange)="set('to', $event)" />
      @if (from() || to()) {
        <button type="button" class="clear" (click)="clear()" title="Clear">✕</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .range { display: inline-flex; align-items: center; gap: 8px; }
    .range .f { width: 168px; }
    .dash { color: var(--muted-2); font-size: 12px; }
    .clear { border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); border-radius: var(--r-sm); width: 38px; height: 38px; cursor: pointer; flex: 0 0 auto; }
    .clear:hover { color: var(--ink); border-color: var(--line-strong); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateRangeComponent), multi: true }],
})
export class DateRangeComponent implements ControlValueAccessor {
  readonly disabled = input(false);
  readonly from = signal<string>('');
  readonly to = signal<string>('');

  private onChange: (v: DateRange) => void = () => {};
  onTouched: () => void = () => {};

  set(which: 'from' | 'to', value: string): void {
    if (which === 'from') { this.from.set(value); } else { this.to.set(value); }
    this.emit();
  }

  clear(): void {
    this.from.set('');
    this.to.set('');
    this.emit();
  }

  private emit(): void {
    this.onChange({ from: this.from() || null, to: this.to() || null });
    this.onTouched();
  }

  writeValue(v: DateRange | null): void {
    this.from.set(v?.from ?? '');
    this.to.set(v?.to ?? '');
  }
  registerOnChange(fn: (v: DateRange) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
