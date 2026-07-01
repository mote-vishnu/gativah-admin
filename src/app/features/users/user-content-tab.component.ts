import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { UserContentRow } from '../../core/models';

type Filter = 'ALL' | 'POST' | 'COMMENT' | 'FLAGGED';

/** Profile Content tab: the user's recent posts & comments as a filterable grid. */
@Component({
  selector: 'app-user-content-tab',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <div class="filters">
      <button class="chip" [class.on]="filter() === 'ALL'" (click)="filter.set('ALL')">All · {{ items().length }}</button>
      <button class="chip" [class.on]="filter() === 'POST'" (click)="filter.set('POST')">Posts · {{ count('POST') }}</button>
      <button class="chip" [class.on]="filter() === 'COMMENT'" (click)="filter.set('COMMENT')">Comments · {{ count('COMMENT') }}</button>
      <button class="chip" [class.on]="filter() === 'FLAGGED'" (click)="filter.set('FLAGGED')">Flagged · {{ flaggedCount() }}</button>
    </div>

    @if (filtered().length) {
      <div class="cgrid">
        @for (c of filtered(); track c.type + c.id) {
          <div class="ccard" [class.gone]="c.removed">
            <div class="ch">
              <span class="ic"><lucide-icon [name]="c.type === 'COMMENT' ? 'corner-down-left' : 'message-square'" [size]="13" /></span>
              <span class="ty">{{ c.type === 'COMMENT' ? 'Comment' : (c.kind ? (c.kind.toLowerCase()) : 'Post') }}</span>
              @if (c.openReports > 0) { <a class="flag" [routerLink]="['/content/posts']">flagged · {{ c.openReports }}</a> }
              @if (c.removed) { <span class="pill sm banned">removed</span> }
            </div>
            <div class="ct">{{ plain(c.snippet) || '(no text)' }}</div>
            <div class="cf"><span>{{ c.createdAt | date: 'MMM d, y' }}</span>@if (c.type === 'POST') { <span>{{ c.views }} views</span> }</div>
          </div>
        }
      </div>
    } @else {
      <div class="empty">No {{ filter() === 'ALL' ? '' : filter().toLowerCase() + ' ' }}content.</div>
    }
  `,
  styles: `
    :host { display: block; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .chip { border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font: inherit; font-size: 12px; font-weight: 600; padding: 7px 13px; border-radius: 999px; cursor: pointer; transition: 0.15s var(--ease); }
    .chip:hover { color: var(--ink); }
    .chip.on { border-color: var(--brand-line); background: var(--brand-soft); color: var(--brand); }
    .cgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
    .ccard { border: 1px solid var(--line); border-radius: 14px; padding: 15px 16px; background: var(--surface); transition: 0.15s var(--ease); }
    .ccard:hover { border-color: var(--line-strong); box-shadow: var(--shadow-sm); }
    .ccard.gone { opacity: 0.55; }
    .ch { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .ch .ic { width: 24px; height: 24px; border-radius: 7px; background: var(--surface-2); display: grid; place-items: center; color: var(--brand); flex: 0 0 auto; }
    .ch .ty { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted-2); font-weight: 700; }
    .ch .flag { margin-left: auto; font-size: 10px; font-weight: 700; color: var(--rose); background: rgba(244,63,94,0.1); border: 1px solid var(--brand-line); border-radius: 999px; padding: 2px 8px; }
    .ct { font-size: 13px; line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .cf { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 11px; color: var(--muted-2); }
    .empty { padding: 50px; text-align: center; color: var(--muted-2); font-size: 13px; }
    .pill.sm { font-size: 9.5px; padding: 1px 7px; }
  `,
})
export class UserContentTabComponent {
  readonly items = input<UserContentRow[]>([]);
  readonly filter = signal<Filter>('ALL');

  readonly filtered = computed(() => {
    const f = this.filter();
    return this.items().filter((c) =>
      f === 'ALL' ? true : f === 'FLAGGED' ? c.openReports > 0 : c.type === f);
  });
  readonly flaggedCount = computed(() => this.items().filter((c) => c.openReports > 0).length);

  count(type: string): number {
    return this.items().filter((c) => c.type === type).length;
  }

  /** Flatten mention tokens to plain @Name for the preview snippet. */
  plain(text: string | null): string {
    return (text || '').replace(/\{@\}\[([^\]]+)\]\((\d+)\)/g, '@$1');
  }
}
