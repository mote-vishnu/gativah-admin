import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../icon';

/**
 * Themed pager for server-paged lists (0-based page index).
 *   <ui-paginator [pageIndex]="i()" [totalPages]="p()?.totalPages ?? 0"
 *                 [totalElements]="p()?.totalElements ?? 0" unit="report"
 *                 (pageChange)="goTo($event)" />
 */
@Component({
  selector: 'ui-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pager">
      <span>{{ countLabel() }}</span>
      <div class="pg">
        <button (click)="prev()" [disabled]="pageIndex() === 0" aria-label="Previous page">
          <lucide-icon name="chevron-left" [size]="15" />
        </button>
        <button disabled>{{ pageIndex() + 1 }} / {{ lastPage() }}</button>
        <button (click)="next()" [disabled]="pageIndex() + 1 >= lastPage()" aria-label="Next page">
          <lucide-icon name="chevron-right" [size]="15" />
        </button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .pg button { display: inline-grid; place-items: center; }
  `,
})
export class PaginatorComponent {
  readonly pageIndex = input(0);
  readonly totalPages = input(0);
  readonly totalElements = input(0);
  /** Singular noun for the count label, e.g. "report" → "12 reports". */
  readonly unit = input('item');
  /** Plural override for irregular nouns, e.g. unit="entry" unitPlural="entries". */
  readonly unitPlural = input('');

  readonly pageChange = output<number>();

  readonly lastPage = computed(() => Math.max(this.totalPages(), 1));
  readonly countLabel = computed(() => {
    const n = this.totalElements();
    const noun = n === 1 ? this.unit() : (this.unitPlural() || `${this.unit()}s`);
    return `${n.toLocaleString('en-US')} ${noun}`;
  });

  prev(): void {
    if (this.pageIndex() > 0) { this.pageChange.emit(this.pageIndex() - 1); }
  }
  next(): void {
    if (this.pageIndex() + 1 < this.lastPage()) { this.pageChange.emit(this.pageIndex() + 1); }
  }
}
