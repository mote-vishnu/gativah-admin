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

interface DayCell {
  day: number;
  iso: string;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

let uid = 0;

/**
 * Fully custom date / datetime picker — the OPEN calendar is themed in both
 * modes (the native date popup can't be styled, same reason ui-select isn't a
 * native <select>). CVA, so `[(ngModel)]` works. Value is the ISO string:
 * `yyyy-MM-dd` (date) or `yyyy-MM-ddTHH:mm` (datetime-local).
 *   <ui-date label="Due date" [(ngModel)]="draft.dueAt" />
 */
@Component({
  selector: 'ui-date',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <div class="dp" [class.open]="open()" [class.invalid]="!!error()" [class.disabled]="isDisabled()">
      <button
        type="button"
        class="trigger"
        [id]="id"
        [disabled]="isDisabled()"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        (click)="toggle()"
        (keydown)="onKey($event)"
        (blur)="onTouched()"
      >
        <lucide-icon class="cal" name="calendar" [size]="16" />
        <span class="val" [class.ph]="!value()">{{ display() || placeholder() || 'Select date…' }}</span>
        @if (clearable() && value() && !isDisabled()) {
          <span class="clear" role="button" tabindex="-1" title="Clear" (click)="clear($event)">✕</span>
        }
      </button>

      @if (open()) {
        <div class="panel" role="dialog" (click)="$event.stopPropagation()">
          <div class="cal-h">
            <button type="button" class="nav" (click)="headerPrev()" aria-label="Previous"><lucide-icon name="chevron-left" [size]="16" /></button>
            @switch (mode()) {
              @case ('days') { <button type="button" class="cal-title" (click)="setMode('months')" title="Pick month / year">{{ monthName() }} {{ viewYear() }} <lucide-icon name="chevron-down" [size]="14" /></button> }
              @case ('months') { <button type="button" class="cal-title" (click)="openYears()" title="Pick year">{{ viewYear() }} <lucide-icon name="chevron-down" [size]="14" /></button> }
              @case ('years') { <button type="button" class="cal-title" (click)="setMode('months')" title="Back to months">{{ yearStart() }} – {{ yearStart() + 11 }}</button> }
            }
            <button type="button" class="nav" (click)="headerNext()" aria-label="Next"><lucide-icon name="chevron-right" [size]="16" /></button>
          </div>

          @switch (mode()) {
            @case ('days') {
              <div class="dow">
                @for (d of weekdays; track $index) { <span>{{ d }}</span> }
              </div>
              <div class="grid">
                @for (c of cells(); track c.iso) {
                  <button
                    type="button"
                    class="cell"
                    [class.out]="!c.inMonth"
                    [class.today]="c.today"
                    [class.on]="c.selected"
                    [disabled]="c.disabled"
                    (click)="pick(c)"
                  >{{ c.day }}</button>
                }
              </div>
            }
            @case ('months') {
              <div class="mgrid">
                @for (m of monthsShort; track $index) {
                  <button type="button" class="mcell" [class.on]="$index === viewMonth()" [class.today]="isCurrentMonth($index)" (click)="pickMonth($index)">{{ m }}</button>
                }
              </div>
            }
            @case ('years') {
              <div class="ygrid">
                @for (y of yearCells(); track y) {
                  <button type="button" class="mcell" [class.on]="y === viewYear()" [class.today]="y === currentYear" (click)="pickYear(y)">{{ y }}</button>
                }
              </div>
            }
          }
          @if (type() === 'datetime-local') {
            <div class="time">
              <lucide-icon name="calendar" [size]="14" />
              <select class="tsel" [value]="hour()" (change)="setHour($event)">
                @for (h of hours; track h) { <option [value]="h">{{ pad(h) }}</option> }
              </select>
              <span class="colon">:</span>
              <select class="tsel" [value]="minute()" (change)="setMinute($event)">
                @for (m of minutes; track m) { <option [value]="m">{{ pad(m) }}</option> }
              </select>
            </div>
          }
          <div class="foot">
            <button type="button" class="lk" (click)="today()">Today</button>
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
    .dp { position: relative; }

    .trigger {
      width: 100%; display: flex; align-items: center; gap: 10px;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm);
      padding: 11px 13px; color: var(--ink); font-size: 14px; font-family: inherit; cursor: pointer;
      outline: none; text-align: left; transition: 0.18s var(--ease);
    }
    .trigger:hover { border-color: var(--line-strong); }
    .dp.open .trigger, .trigger:focus-visible { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
    .dp.invalid .trigger { border-color: rgba(251, 113, 133, 0.55); }
    .dp.disabled .trigger { opacity: 0.5; cursor: not-allowed; }
    .cal { color: var(--muted-2); flex: 0 0 auto; }
    .val { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .val.ph { color: var(--muted-2); }
    .clear { color: var(--muted-2); font-size: 12px; line-height: 1; padding: 2px 4px; border-radius: 6px; flex: 0 0 auto; }
    .clear:hover { color: var(--ink); background: var(--surface-3); }

    .panel {
      position: absolute; left: 0; top: calc(100% + 6px); z-index: 50; width: 280px; max-width: 92vw;
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm);
      box-shadow: var(--shadow); padding: 12px; animation: pop 0.12s var(--ease);
    }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .cal-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .cal-title { display: inline-flex; align-items: center; gap: 5px; font-family: var(--sans); font-weight: 700; font-size: 14px; letter-spacing: -0.01em; border: 0; background: transparent; color: var(--ink); cursor: pointer; padding: 5px 10px; border-radius: 8px; }
    .cal-title lucide-icon { color: var(--muted-2); }
    .cal-title:hover { background: var(--surface-2); color: var(--brand); }
    .cal-title:hover lucide-icon { color: var(--brand); }
    .nav { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); border-radius: 8px; cursor: pointer; }
    .nav:hover { color: var(--ink); border-color: var(--line-strong); }

    .mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .ygrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .mcell {
      padding: 11px 0; border: 0; background: var(--surface-2); color: var(--ink-2); font-size: 13px;
      font-family: inherit; border-radius: 9px; cursor: pointer; transition: 0.12s var(--ease);
    }
    .mcell:hover { background: var(--surface-3); color: var(--ink); }
    .mcell.today { box-shadow: inset 0 0 0 1px var(--brand-line); color: var(--brand); font-weight: 700; }
    .mcell.on { background: var(--brand); color: #fff; font-weight: 700; }

    .dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
    .dow span { text-align: center; font-size: 10.5px; font-weight: 600; color: var(--muted-2); text-transform: uppercase; letter-spacing: 0.03em; padding: 4px 0; }

    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cell {
      aspect-ratio: 1; display: grid; place-items: center; border: 0; background: transparent;
      color: var(--ink-2); font-size: 13px; font-family: inherit; border-radius: 9px; cursor: pointer;
      transition: 0.12s var(--ease);
    }
    .cell:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
    .cell.out { color: var(--muted-2); opacity: 0.5; }
    .cell.today { box-shadow: inset 0 0 0 1px var(--brand-line); color: var(--brand); font-weight: 700; }
    .cell.on { background: var(--brand); color: #fff; font-weight: 700; }
    .cell.on:hover { background: var(--brand); color: #fff; }
    .cell:disabled { opacity: 0.25; cursor: not-allowed; }

    .time { display: flex; align-items: center; gap: 7px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted-2); }
    .tsel { background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; color: var(--ink); font-family: inherit; font-size: 13px; }
    .colon { color: var(--muted-2); font-weight: 700; }

    .foot { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
    .foot .lk { border: 0; background: transparent; color: var(--brand); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
    .foot .lk:hover { text-decoration: underline; }

    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateComponent), multi: true }],
})
export class DateComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly id = `ui-date-${uid++}`;

  readonly label = input('');
  /** 'date' → yyyy-MM-dd, 'datetime-local' → yyyy-MM-ddTHH:mm. */
  readonly type = input<'date' | 'datetime-local'>('date');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly min = input('');
  readonly max = input('');
  readonly clearable = input(true);
  readonly disabled = input(false);

  readonly valueChange = output<string>();

  readonly weekdays = WEEKDAYS;
  readonly monthsShort = MONTHS_SHORT;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly minutes = Array.from({ length: 60 }, (_, i) => i);
  readonly currentYear = new Date().getFullYear();
  private readonly currentMonth = new Date().getMonth();

  readonly value = signal('');
  readonly open = signal(false);
  readonly mode = signal<'days' | 'months' | 'years'>('days');
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly yearStart = signal(Math.floor(new Date().getFullYear() / 12) * 12);
  readonly hour = signal(0);
  readonly minute = signal(0);

  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  readonly monthName = computed(() => MONTHS[this.viewMonth()]);
  readonly yearCells = computed(() => Array.from({ length: 12 }, (_, i) => this.yearStart() + i));

  isCurrentMonth(month: number): boolean {
    return month === this.currentMonth && this.viewYear() === this.currentYear;
  }

  /** Human-readable value shown on the trigger. */
  readonly display = computed(() => {
    const v = this.value();
    if (!v) { return ''; }
    const [datePart, timePart] = v.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) { return v; }
    let out = `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
    if (this.type() === 'datetime-local' && timePart) { out += ` · ${timePart.slice(0, 5)}`; }
    return out;
  });

  /** 6-week day grid for the displayed month. */
  readonly cells = computed<DayCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay()); // back up to the Sunday
    const todayIso = iso(new Date());
    const selectedIso = this.value().split('T')[0];
    const minV = this.min();
    const maxV = this.max();
    const out: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const cellIso = iso(d);
      out.push({
        day: d.getDate(),
        iso: cellIso,
        inMonth: d.getMonth() === month,
        today: cellIso === todayIso,
        selected: cellIso === selectedIso,
        disabled: (!!minV && cellIso < minV) || (!!maxV && cellIso > maxV),
      });
    }
    return out;
  });

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  toggle(): void {
    if (this.isDisabled()) { return; }
    this.open() ? this.close() : this.openCal();
  }

  private openCal(): void {
    const base = this.value().split('T')[0];
    const d = base ? new Date(base + 'T00:00:00') : new Date();
    this.viewYear.set(d.getFullYear());
    this.viewMonth.set(d.getMonth());
    this.mode.set('days');
    this.open.set(true);
  }

  close(): void { this.open.set(false); }

  /** Header ‹ — meaning depends on the current view mode. */
  headerPrev(): void {
    switch (this.mode()) {
      case 'days': this.shiftMonth(-1); break;
      case 'months': this.viewYear.update((y) => y - 1); break;
      case 'years': this.yearStart.update((y) => y - 12); break;
    }
  }

  headerNext(): void {
    switch (this.mode()) {
      case 'days': this.shiftMonth(1); break;
      case 'months': this.viewYear.update((y) => y + 1); break;
      case 'years': this.yearStart.update((y) => y + 12); break;
    }
  }

  setMode(m: 'days' | 'months' | 'years'): void {
    this.mode.set(m);
  }

  openYears(): void {
    this.yearStart.set(Math.floor(this.viewYear() / 12) * 12);
    this.mode.set('years');
  }

  pickMonth(month: number): void {
    this.viewMonth.set(month);
    this.mode.set('days');
  }

  pickYear(year: number): void {
    this.viewYear.set(year);
    this.mode.set('months');
  }

  private shiftMonth(delta: number): void {
    let m = this.viewMonth() + delta;
    let y = this.viewYear();
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
  }

  pick(c: DayCell): void {
    if (c.disabled) { return; }
    this.commit(c.iso);
    if (this.type() === 'date') { this.close(); }
  }

  today(): void {
    const t = iso(new Date());
    this.viewYear.set(new Date().getFullYear());
    this.viewMonth.set(new Date().getMonth());
    this.commit(t);
    if (this.type() === 'date') { this.close(); }
  }

  setHour(e: Event): void { this.hour.set(Number((e.target as HTMLSelectElement).value)); this.recommitTime(); }
  setMinute(e: Event): void { this.minute.set(Number((e.target as HTMLSelectElement).value)); this.recommitTime(); }

  private recommitTime(): void {
    const date = this.value().split('T')[0] || iso(new Date());
    this.commit(date);
  }

  private commit(dateIso: string): void {
    const v = this.type() === 'datetime-local'
      ? `${dateIso}T${pad(this.hour())}:${pad(this.minute())}`
      : dateIso;
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
    if (this.isDisabled()) { return; }
    if (event.key === 'Escape' && this.open()) { event.preventDefault(); this.close(); }
    else if ((event.key === 'Enter' || event.key === ' ') && !this.open()) { event.preventDefault(); this.openCal(); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  writeValue(v: string | null): void {
    const s = v == null ? '' : String(v);
    this.value.set(s);
    const [datePart, timePart] = s.split('T');
    if (timePart) {
      const [h, m] = timePart.split(':').map(Number);
      this.hour.set(h || 0);
      this.minute.set(m || 0);
    }
    if (datePart) {
      const [y, mo] = datePart.split('-').map(Number);
      if (y) { this.viewYear.set(y); }
      if (mo) { this.viewMonth.set(mo - 1); }
    }
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}

function pad(n: number): string { return n < 10 ? '0' + n : String(n); }

/** Local-date → yyyy-MM-dd (no timezone shift). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
