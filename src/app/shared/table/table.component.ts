import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface TableColumn {
  label: string;
  align?: 'left' | 'center' | 'right';
  /** Optional fixed width, e.g. '120px' or '20%'. */
  width?: string;
}

/**
 * Themed table chrome — card wrapper, header row from a `columns` config, plus
 * built-in loading and empty states. Rows stay caller-owned (rich cells: avatars,
 * pills, action buttons), projected into the body:
 *
 *   <ui-table [columns]="cols" [loading]="loading()" [empty]="rows().length === 0" emptyText="No data.">
 *     @for (r of rows(); track r.id) { <tr>…</tr> }
 *   </ui-table>
 *
 * The colspan for loading/empty rows is derived from columns.length, so keep the
 * projected <tr> cell count in sync with `columns`.
 */
@Component({
  selector: 'ui-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class.card]="!flush()" class="tbl">
      <table>
        <thead>
          <tr>
            @for (c of columns(); track $index) {
              <th [style.text-align]="c.align || null" [style.width]="c.width || null">{{ c.label }}</th>
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

  readonly skeleton = [0, 1, 2, 3, 4];
}
