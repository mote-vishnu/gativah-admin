import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent } from '../icon';
import { SelectOption } from './select.component';

/**
 * Custom multi-select dropdown — value is an array of selected option values.
 * Trigger shows selected as chips (collapsing to "+N" past `maxChips`); the menu
 * has a search/filter box and checkable rows that stay open while you pick.
 *
 *   <ui-multiselect label="Roles" [options]="opts" [(ngModel)]="roleIds" />
 *
 * Remote search: when [remoteSearch]="true", a debounced (searchChange) fires once
 * the typed query has no local match, so the parent can fetch more options from the
 * backend and feed them back through [options] (set [loading] while fetching):
 *
 *   <ui-multiselect [remoteSearch]="true" [loading]="searching()"
 *                   [options]="opts()" (searchChange)="fetch($event)" [(ngModel)]="ids" />
 *
 * Implements ControlValueAccessor (value: string[]). For numeric ids, map to/from
 * String at the call site. Selected labels are cached so chips survive option-list
 * replacement during remote search.
 */
@Component({
  selector: 'ui-multiselect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (label()) { <label class="field" [attr.for]="id">{{ label() }}</label> }
    <div class="ms" [class.sm]="size() === 'sm'" [class.open]="open()" [class.invalid]="!!error()" [class.disabled]="isDisabled()">
      <button
        type="button"
        class="trigger"
        [id]="id"
        [disabled]="isDisabled()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="toggle()"
        (keydown)="onTriggerKey($event)"
        (blur)="onTouched()"
      >
        <span class="vals">
          @if (selected().length === 0) {
            <span class="ph">{{ placeholder() || 'Select…' }}</span>
          } @else {
            @for (o of shownChips(); track o.value) {
              <span class="chip">{{ o.label }}<span class="x" (click)="remove($event, o.value)">×</span></span>
            }
            @if (overflow() > 0) { <span class="more">+{{ overflow() }}</span> }
          }
        </span>
        <lucide-icon class="chev" name="chevron-down" [size]="size() === 'sm' ? 14 : 16" />
      </button>

      @if (open()) {
        <div class="panel" role="listbox" aria-multiselectable="true">
          @if (searchable()) {
            <div class="search">
              <lucide-icon [name]="loading() ? 'loader' : 'search'" [size]="14" [class.spin]="loading()" />
              <input
                #searchBox
                type="text"
                [value]="query()"
                placeholder="Search…"
                (input)="onQuery($event)"
                (keydown)="onSearchKey($event)"
              />
            </div>
          }
          <div class="opts">
            @for (o of filtered(); track o.value; let i = $index) {
              <button
                type="button"
                class="opt"
                role="option"
                [class.active]="i === activeIndex()"
                [class.disabled]="o.disabled"
                [attr.aria-selected]="isSelected(o.value)"
                (click)="toggleOption($event, o)"
                (mouseenter)="activeIndex.set(i)"
              >
                <span class="box" [class.on]="isSelected(o.value)"><lucide-icon name="check" [size]="12" /></span>
                <span class="lab">{{ o.label }}</span>
              </button>
            } @empty {
              <div class="opt empty">{{ loading() ? 'Searching…' : (query() ? 'No matches' : 'No options') }}</div>
            }
          </div>
        </div>
      }
    </div>
    @if (error()) { <span class="msg err">{{ error() }}</span> }
    @else if (hint()) { <span class="msg hint">{{ hint() }}</span> }
  `,
  styles: `
    :host { display: block; }
    .ms { position: relative; }

    .trigger {
      width: 100%; display: flex; align-items: center; gap: 10px; justify-content: space-between;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-sm);
      padding: 8px 11px 8px 13px; min-height: 44px; color: var(--ink); font-size: 14px; font-family: inherit;
      cursor: pointer; outline: none; text-align: left; transition: 0.18s var(--ease);
    }
    .trigger:hover { border-color: var(--line-strong); }
    .ms.open .trigger, .trigger:focus-visible { border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
    .ms.invalid .trigger { border-color: rgba(251, 113, 133, 0.55); }
    .ms.disabled .trigger { opacity: 0.5; cursor: not-allowed; }
    .ms.sm .trigger { min-height: 36px; padding: 5px 9px 5px 11px; }

    .vals { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; overflow: hidden; }
    .ph { color: var(--muted-2); }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 500;
      padding: 3px 4px 3px 9px; border-radius: 999px; background: var(--brand-soft);
      box-shadow: inset 0 0 0 1px var(--brand-line); color: var(--brand);
    }
    .chip .x { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 999px; font-size: 13px; line-height: 1; cursor: pointer; }
    .chip .x:hover { background: rgba(249, 115, 22, 0.2); }
    .more { font-size: 11px; color: var(--muted-2); font-weight: 600; }
    .chev { color: var(--muted-2); flex: 0 0 auto; transition: transform 0.18s var(--ease); }
    .ms.open .chev { transform: rotate(180deg); }

    .panel {
      position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 50;
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm);
      box-shadow: var(--shadow); padding: 5px; animation: pop 0.12s var(--ease);
    }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .search {
      display: flex; align-items: center; gap: 8px; padding: 7px 10px; margin-bottom: 4px;
      border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted-2);
    }
    .search input {
      flex: 1; min-width: 0; background: transparent; border: 0; outline: none;
      color: var(--ink); font-size: 13px; font-family: inherit;
    }
    .spin { animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .opts { max-height: 240px; overflow-y: auto; }

    .opt {
      width: 100%; display: flex; align-items: center; gap: 10px;
      background: transparent; border: 0; border-radius: 8px; padding: 9px 11px; cursor: pointer;
      color: var(--ink-2); font-size: 13px; font-family: inherit; text-align: left; transition: 0.12s var(--ease);
    }
    .opt.active { background: var(--surface-2); color: var(--ink); }
    .opt.disabled { opacity: 0.45; cursor: not-allowed; }
    .opt.empty { color: var(--muted-2); cursor: default; }
    .box {
      width: 18px; height: 18px; border-radius: 6px; border: 1px solid var(--line-strong);
      background: var(--surface-2); display: grid; place-items: center; flex: 0 0 auto;
      color: transparent; transition: 0.15s var(--ease);
    }
    .box.on { background: linear-gradient(135deg, var(--brand), var(--brand-3)); border-color: transparent; color: #fff; }

    .msg { display: block; font-size: 11.5px; margin-top: 6px; }
    .msg.hint { color: var(--muted-2); }
    .msg.err { color: var(--rose); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MultiSelectComponent), multi: true }],
})
export class MultiSelectComponent implements ControlValueAccessor, OnDestroy {
  private static seq = 0;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  readonly id = `ui-multiselect-${MultiSelectComponent.seq++}`;

  readonly label = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly placeholder = input('');
  readonly options = input<SelectOption[]>([]);
  readonly size = input<'md' | 'sm'>('md');
  readonly maxChips = input(4);
  readonly searchable = input(true);
  readonly disabled = input(false);
  /** Emit (searchChange) when the local list has no match for the query. */
  readonly remoteSearch = input(false);
  /** Show a searching indicator + "Searching…" while the parent fetches. */
  readonly loading = input(false);
  /** Debounce before (searchChange) fires, in ms. */
  readonly debounceMs = input(300);

  /** Debounced query for the parent to run a backend search against. */
  readonly searchChange = output<string>();

  readonly value = signal<string[]>([]);
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(-1);
  private readonly cvaDisabled = signal(false);
  /** value → label, kept across option-list changes so chips stay labelled. */
  private readonly labelCache = signal(new Map<string, string>());
  isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  readonly selected = computed(() => {
    const cache = this.labelCache();
    return this.value().map((v) => ({ value: v, label: cache.get(v) ?? v }));
  });
  readonly shownChips = computed(() => this.selected().slice(0, this.maxChips()));
  readonly overflow = computed(() => Math.max(0, this.selected().length - this.maxChips()));
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  private debounceHandle: ReturnType<typeof setTimeout> | undefined;
  private onChange: (v: string[]) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    // Merge incoming option labels into the cache (untracked read avoids a loop).
    effect(() => {
      const opts = this.options();
      const prev = untracked(this.labelCache);
      const next = new Map(prev);
      let changed = false;
      for (const o of opts) {
        if (next.get(o.value) !== o.label) { next.set(o.value, o.label); changed = true; }
      }
      if (changed) { this.labelCache.set(next); }
    });
    // Autofocus the filter box whenever the menu opens.
    effect(() => {
      if (this.open() && this.searchable()) {
        this.searchBox()?.nativeElement.focus();
      }
    });
  }

  isSelected(value: string): boolean {
    return this.value().includes(value);
  }

  toggle(): void {
    if (this.isDisabled()) { return; }
    this.open() ? this.close() : this.openMenu();
  }

  private openMenu(): void {
    this.query.set('');
    this.activeIndex.set(-1);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
    clearTimeout(this.debounceHandle);
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.scheduleRemoteSearch();
  }

  private scheduleRemoteSearch(): void {
    if (!this.remoteSearch()) { return; }
    clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      const q = this.query().trim();
      // Only hit the backend when the already-loaded options don't satisfy the query.
      if (q && this.filtered().length === 0) {
        this.searchChange.emit(q);
      }
    }, this.debounceMs());
  }

  toggleOption(event: Event, o: SelectOption): void {
    event.stopPropagation();
    if (o.disabled) { return; }
    const next = this.isSelected(o.value)
      ? this.value().filter((v) => v !== o.value)
      : [...this.value(), o.value];
    this.commit(next);
  }

  remove(event: Event, value: string): void {
    event.stopPropagation();
    if (this.isDisabled()) { return; }
    this.commit(this.value().filter((v) => v !== value));
  }

  private commit(next: string[]): void {
    this.value.set(next);
    this.onChange(next);
  }

  /** Keyboard while focus is on the closed trigger. */
  onTriggerKey(event: KeyboardEvent): void {
    if (this.isDisabled()) { return; }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open()) { this.openMenu(); }
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.close();
    }
  }

  /** Keyboard while focus is in the filter box. */
  onSearchKey(event: KeyboardEvent): void {
    const list = this.filtered();
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Enter':
        event.preventDefault();
        { const o = list[this.activeIndex()]; if (o) { this.toggleOption(event, o); } }
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
    }
  }

  private move(delta: number): void {
    const n = this.filtered().length;
    if (!n) { return; }
    let i = this.activeIndex();
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!this.filtered()[i]?.disabled) { break; }
    }
    this.activeIndex.set(i);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.debounceHandle);
  }

  writeValue(v: string[] | null): void { this.value.set(Array.isArray(v) ? v.map(String) : []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.cvaDisabled.set(disabled); }
}
