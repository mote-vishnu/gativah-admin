import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon';

let uid = 0;

/**
 * Fully custom themed time picker (24h value, 12h display). CVA so `[(ngModel)]`
 * works. Value is `HH:mm`. Two scrollable hour / minute columns in a themed
 * popup — no native time popup.
 *   <ui-time label="Start" [(ngModel)]="from" [minuteStep]="5" />
 */
@Component({
  selector: 'ui-time',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <div class="tp" [class.open]="open()" [class.invalid]="!!error()" [class.disabled]="isDisabled()">
      <button type="button" class="trigger" [id]="id" [disabled]="isDisabled()"
              [attr.aria-expanded]="open()" aria-haspopup="dialog" (click)="toggle()" (keydown)="onKey($event)" (blur)="onTouched()">
        <lucide-icon class="cal" name="clock" [size]="16" />
        <span class="val" [class.ph]="!value()">{{ display() || placeholder() || 'Select time…' }}</span>
        @if (clearable() && value() && !isDisabled()) {
          <span class="clear" role="button" tabindex="-1" title="Clear" (click)="clear($event)">✕</span>
        }
      </button>

      @if (open()) {
        <div class="panel" role="dialog">
          <div class="cols">
            <div class="col" #hcol>
              @for (h of hours; track h) {
                <button type="button" class="tcell" [class.on]="h === hour()" (click)="setHour(h)">{{ pad(h) }}</button>
              }
            </div>
            <span class="sep">:</span>
            <div class="col" #mcol>
              @for (m of minuteList(); track m) {
                <button type="button" class="tcell" [class.on]="m === minute()" (click)="setMinute(m)">{{ pad(m) }}</button>
              }
            </div>
          </div>
          <div class="foot">
            <button type="button" class="lk" (click)="now()">Now</button>
            @if (clearable() && value()) { <button type="button" class="lk" (click)="clear($event)">Clear</button> }
          </div>
        </div>
      }
    </div>
    @if (error()) { <span class="msg err">{{ error() }}</span> }
    @else if (hint()) { <span class="msg hint">{{ hint() }}</span> }
  `,
  styles: `
    :host { display: block; }
    .tp { position: relative; }
    .trigger { width: 100%; display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 11px 13px; color: var(--ink); font-size: 14px; font-family: inherit; cursor: pointer; outline: none; text-align: left; transition: 0.18s var(--ease); }
    .trigger:hover { border-color: var(--line-strong); }
    .tp.open .trigger, .trigger:focus-visible { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
    .tp.invalid .trigger { border-color: rgba(251, 113, 133, 0.55); }
    .tp.disabled .trigger { opacity: 0.5; cursor: not-allowed; }
    .cal { color: var(--muted-2); flex: 0 0 auto; }
    .val { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .val.ph { color: var(--muted-2); }
    .clear { color: var(--muted-2); font-size: 12px; line-height: 1; padding: 2px 4px; border-radius: 6px; flex: 0 0 auto; }
    .clear:hover { color: var(--ink); background: var(--surface-3); }

    .panel { position: absolute; left: 0; top: calc(100% + 6px); z-index: 50; width: 200px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm); box-shadow: var(--shadow); padding: 10px; animation: pop 0.12s var(--ease); }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .cols { display: flex; align-items: stretch; gap: 6px; }
    .col { flex: 1; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; }
    .sep { display: grid; place-items: center; font-weight: 700; color: var(--muted-2); }
    .tcell { padding: 8px 0; border: 0; background: transparent; color: var(--ink-2); font-size: 13px; font-family: var(--mono); border-radius: 8px; cursor: pointer; transition: 0.12s var(--ease); }
    .tcell:hover { background: var(--surface-2); color: var(--ink); }
    .tcell.on { background: var(--brand); color: #fff; font-weight: 700; }
    .foot { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
    .foot .lk { border: 0; background: transparent; color: var(--brand); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
    .foot .lk:hover { text-decoration: underline; }

    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimeComponent), multi: true }],
})
export class TimeComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly id = `ui-time-${uid++}`;

  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly minuteStep = input(1);
  readonly clearable = input(true);
  readonly disabled = input(false);

  readonly valueChange = output<string>();

  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly value = signal('');
  readonly open = signal(false);
  readonly hour = signal(9);
  readonly minute = signal(0);

  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  readonly minuteList = computed(() => {
    const step = Math.max(1, this.minuteStep());
    return Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  });

  readonly display = computed(() => {
    const v = this.value();
    if (!v) { return ''; }
    const [h, m] = v.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${ampm}`;
  });

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  toggle(): void {
    if (this.isDisabled()) { return; }
    this.open.update((o) => !o);
  }

  close(): void { this.open.set(false); }

  setHour(h: number): void { this.hour.set(h); this.commit(); }
  setMinute(m: number): void { this.minute.set(m); this.commit(); }

  now(): void {
    const d = new Date();
    this.hour.set(d.getHours());
    this.minute.set(d.getMinutes());
    this.commit();
    this.close();
  }

  private commit(): void {
    const v = `${pad(this.hour())}:${pad(this.minute())}`;
    this.value.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
    this.onTouched();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.value.set('');
    this.onChange('');
    this.valueChange.emit('');
    this.onTouched();
    this.close();
  }

  pad(n: number): string { return pad(n); }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open()) { event.preventDefault(); this.close(); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) { this.close(); }
  }

  writeValue(v: string | null): void {
    const s = v == null ? '' : String(v);
    this.value.set(s);
    if (s) {
      const [h, m] = s.split(':').map(Number);
      this.hour.set(h || 0);
      this.minute.set(m || 0);
    }
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }
