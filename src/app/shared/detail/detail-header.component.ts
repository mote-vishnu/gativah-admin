import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../icon';

/**
 * Standard detail-page header: back link + avatar/initials tile + title +
 * subtitle, with projected slots for status pills, actions and a meta strip.
 *   <ui-detail-header backLink="/clubs" backLabel="Back to clubs"
 *                     [avatar]="initials" [title]="c.name" [subtitle]="…">
 *     <span detail-status>…pill…</span>
 *     <button detail-actions>…</button>
 *     <div detail-meta>…</div>
 *   </ui-detail-header>
 */
@Component({
  selector: 'ui-detail-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    @if (backLink()) {
      <a [routerLink]="backLink()" class="back"><lucide-icon name="chevron-left" [size]="15" /> {{ backLabel() }}</a>
    }
    <div class="head">
      <div class="id">
        @if (avatar()) { <span class="av" [class]="'tint-' + tint()">{{ avatar() }}</span> }
        <div class="idtext">
          <div class="titlerow">
            <h1>{{ title() }}</h1>
            <ng-content select="[detail-status]" />
          </div>
          @if (subtitle()) { <p class="sub">{{ subtitle() }}</p> }
        </div>
      </div>
      <div class="actions"><ng-content select="[detail-actions]" /></div>
    </div>
    <ng-content select="[detail-meta]" />
  `,
  styles: `
    :host { display: block; }
    .back { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .id { display: flex; align-items: center; gap: 15px; min-width: 0; }
    .av { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 14px; display: grid; place-items: center; font-family: var(--sans); font-weight: 800; font-size: 19px; }
    .idtext { min-width: 0; }
    .titlerow { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
    h1 { font-family: var(--sans); font-weight: 800; font-size: 23px; margin: 0; letter-spacing: -0.02em; }
    .sub { color: var(--muted-2); font-size: 12.5px; margin: 5px 0 0; }
    .actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }
  `,
})
export class DetailHeaderComponent {
  readonly backLink = input('');
  readonly backLabel = input('Back');
  readonly avatar = input('');
  readonly title = input('');
  readonly subtitle = input('');
  /** Avatar tile tint — orange/cyan/green/rose/violet/amber. */
  readonly tint = input<'orange' | 'cyan' | 'green' | 'rose' | 'violet' | 'amber'>('green');
}
