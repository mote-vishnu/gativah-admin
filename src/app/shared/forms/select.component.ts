import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Fully custom dropdown (not a native <select>, so the OPEN menu is themeable in
 * both themes — native option popups can't be styled). Options come from an array:
 *   <ui-select label="Status" [options]="opts" [(ngModel)]="status" />
 *   <ui-select size="sm" [options]="opts" [ngModel]="x" (ngModelChange)="..." />
 * Implements ControlValueAccessor, so ngModel / reactive forms work as usual.
 */
@Component({
  selector: 'ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <div class="sel" [class.sm]="size() === 'sm'" [class.open]="open()" [class.invalid]="!!error()" [class.disabled]="isDisabled()">
      <button
        type="button"
        class="trigger"
        [id]="id"
        [disabled]="isDisabled()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle()"
        (keydown)="onKey($event)"
        (blur)="onTouched()"
      >
        <span class="val" [class.ph]="!selectedLabel()">{{ selectedLabel() || placeholder() || 'Select…' }}</span>
        <lucide-icon class="chev" name="chevron-down" [size]="size() === 'sm' ? 14 : 16" />
      </button>

      @if (open()) {
        <div class="panel" role="listbox">
          @for (o of options(); track o.value; let i = $index) {
            <button
              type="button"
              class="opt"
              role="option"
              [class.on]="o.value === value()"
              [class.active]="i === activeIndex()"
              [class.disabled]="o.disabled"
              [attr.aria-selected]="o.value === value()"
              (click)="choose(o)"
              (mouseenter)="activeIndex.set(i)"
            >
              <span>{{ o.label }}</span>
              @if (o.value === value()) { <lucide-icon name="check" [size]="14" /> }
            </button>
          } @empty {
            <div class="opt empty">No options</div>
          }
        </div>
      }
    </div>
    @if (error()) { <span class="msg err">{{ error() }}</span> }
    @else if (hint()) { <span class="msg hint">{{ hint() }}</span> }
  `,
  styles: `
    :host { display: block; }
    .sel { position: relative; }

    .trigger {
      width: 100%; display: flex; align-items: center; gap: 10px; justify-content: space-between;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm);
      padding: 11px 13px; color: var(--ink); font-size: 14px; font-family: inherit; cursor: pointer;
      outline: none; text-align: left; transition: 0.18s var(--ease);
    }
    .trigger:hover { border-color: var(--line-strong); }
    .sel.open .trigger, .trigger:focus-visible { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
    .sel.invalid .trigger { border-color: rgba(251, 113, 133, 0.55); }
    .sel.disabled .trigger { opacity: 0.5; cursor: not-allowed; }
    .val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .val.ph { color: var(--muted-2); }
    .chev { color: var(--muted-2); flex: 0 0 auto; transition: transform 0.18s var(--ease); }
    .sel.open .chev { transform: rotate(180deg); }

    .sel.sm .trigger { padding: 7px 11px; font-size: 12px; border-radius: 9px; }

    .panel {
      position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 50;
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm);
      box-shadow: var(--shadow); padding: 5px; max-height: 280px; overflow-y: auto;
      animation: pop 0.12s var(--ease);
    }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .opt {
      width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
      background: transparent; border: 0; border-radius: 8px; padding: 9px 11px; cursor: pointer;
      color: var(--ink-2); font-size: 13px; font-family: inherit; text-align: left; transition: 0.12s var(--ease);
    }
    .opt.active { background: var(--surface-2); color: var(--ink); }
    .opt.on { color: var(--brand); }
    .opt .check, .opt lucide-icon { color: var(--brand); }
    .opt.disabled { opacity: 0.45; cursor: not-allowed; }
    .opt.empty { color: var(--muted-2); cursor: default; justify-content: flex-start; }

    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
})
export class SelectComponent implements ControlValueAccessor {
  private static seq = 0;
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly id = `ui-select-${SelectComponent.seq++}`;

  readonly label = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly placeholder = input('');
  readonly options = input<SelectOption[]>([]);
  readonly size = input<'md' | 'sm'>('md');
  readonly disabled = input(false);

  readonly value = signal('');
  readonly open = signal(false);
  readonly activeIndex = signal(-1);
  private readonly cvaDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  readonly selectedLabel = computed(() => this.options().find((o) => o.value === this.value())?.label ?? '');

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  toggle(): void {
    if (this.isDisabled()) { return; }
    this.open() ? this.close() : this.openMenu();
  }

  private openMenu(): void {
    this.open.set(true);
    this.activeIndex.set(this.options().findIndex((o) => o.value === this.value()));
  }

  close(): void { this.open.set(false); }

  choose(o: SelectOption): void {
    if (o.disabled) { return; }
    this.value.set(o.value);
    this.onChange(o.value);
    this.close();
  }

  onKey(event: KeyboardEvent): void {
    if (this.isDisabled()) { return; }
    const opts = this.options();
    switch (event.key) {
      case 'Escape':
        if (this.open()) { event.preventDefault(); this.close(); }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) { this.openMenu(); break; }
        { const o = opts[this.activeIndex()]; if (o) { this.choose(o); } }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) { this.openMenu(); break; }
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) { this.openMenu(); break; }
        this.move(-1);
        break;
    }
  }

  private move(delta: number): void {
    const n = this.options().length;
    if (!n) { return; }
    let i = this.activeIndex();
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!this.options()[i]?.disabled) { break; }
    }
    this.activeIndex.set(i);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  writeValue(v: string | number | null): void { this.value.set(v == null ? '' : String(v)); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}
