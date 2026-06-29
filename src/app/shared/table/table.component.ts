import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon';

export interface TableColumn {
  label: string;
  align?: 'left' | 'center' | 'right';
  /** Optional fixed width, e.g. '120px' or '20%'. */
  width?: string;
  /** Server-side sort key. When set, the header becomes clickable and emits (sortChange). */
  sortKey?: string;
}

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Themed table chrome — card wrapper, header row from a `columns` config, plus
 * built-in loading and empty states. Rows stay caller-owned (rich cells: avatars,
 * pills, action buttons), projected into the body:
 *
 *   <ui-table [columns]="cols" [loading]="loading()" [empty]="rows().length === 0" emptyText="No data."
 *             [sort]="sort()" (sortChange)="onSort($event)">
 *     @for (r of rows(); track r.id) { <tr>…</tr> }
 *   </ui-table>
 *
 * Columns with a `sortKey` render a clickable, aria-sort header; clicking emits
 * (sortChange) toggling asc/desc. The colspan for loading/empty rows is derived
 * from columns.length, so keep the projected <tr> cell count in sync.
 */
@Component({
  selector: 'ui-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div [class.card]="!flush()" class="tbl">
      <table>
        <thead>
          <tr>
            @for (c of columns(); track $index) {
              <th [style.text-align]="c.align || null" [style.width]="c.width || null"
                  [class.sortable]="!!c.sortKey" [attr.aria-sort]="ariaSort(c)" (click)="onHeaderClick(c)">
                {{ c.label }}
                @if (c.sortKey) {
                  <lucide-icon class="sort-ic" [class.on]="sort()?.key === c.sortKey"
                               [name]="sortIcon(c)" [size]="13" />
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            @for (s of skeleton; track s) {
              <tr class="sk"><td [attr.colspan]="columns().length"><div class="bar"></div></td></tr>
            }
          } @else if (empty()) {
            <tr><td [attr.colspan]="columns().length"><div class="empty">{{ emptyText() }}</div></td></tr>
          } @else {
            <ng-content />
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .tbl { overflow-x: auto; }
    .tbl.card { padding: 6px; }
    th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    th.sortable:hover { color: var(--ink); }
    .sort-ic { opacity: 0; margin-left: 4px; vertical-align: -2px; transition: 0.12s var(--ease); }
    th.sortable:hover .sort-ic { opacity: 0.5; }
    .sort-ic.on { opacity: 1; color: var(--brand); }
    .sk td { padding: 14px; }
    .bar { height: 12px; border-radius: 6px; background: var(--surface-3); position: relative; overflow: hidden; }
    .bar::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
      animation: shimmer 1.2s var(--ease) infinite;
    }
    @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  `,
})
export class TableComponent {
  readonly columns = input.required<TableColumn[]>();
  readonly loading = input(false);
  readonly empty = input(false);
  readonly emptyText = input('Nothing to show.');
  /** Drop the surrounding card (when the table already sits inside one). */
  readonly flush = input(false);
  readonly sort = input<SortState | null>(null);
  readonly sortChange = output<SortState>();

  readonly skeleton = [0, 1, 2, 3, 4];

  onHeaderClick(c: TableColumn): void {
    if (!c.sortKey) return;
    const cur = this.sort();
    const dir: SortDir = cur != null && cur.key === c.sortKey && cur.dir === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key: c.sortKey!, dir });
  }

  ariaSort(c: TableColumn): string | null {
    if (!c.sortKey) return null;
    const cur = this.sort();
    if (cur?.key !== c.sortKey) return 'none';
    return cur.dir === 'asc' ? 'ascending' : 'descending';
  }

  sortIcon(c: TableColumn): string {
    const cur = this.sort();
    if (cur != null && cur.key === c.sortKey && cur.dir === 'desc') return 'chevron-down';
    return 'chevron-up';
  }
}
