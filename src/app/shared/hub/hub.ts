import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../icon';

/** One navigable card on a hub. `perm` (FEATURE:ACTION) hides it when the user lacks it. */
export interface HubTile {
  label: string;
  desc: string;
  icon: string;
  link: string;
  tint?: string; // tint-orange | tint-cyan | tint-green | tint-rose | tint-violet | tint-amber
  perm?: string;
}

export interface HubSection {
  title?: string;
  tiles: HubTile[];
}

export interface HubConfig {
  title: string;
  subtitle?: string;
  icon?: string;
  tint?: string;
  sections: HubSection[];
}

/**
 * Reusable hub surface: a titled header + grouped grid of navigable tile cards.
 * Used both for the top-level module landing and for each module's own hub.
 * Tiles the user can't access (by `perm`) are filtered out; empty sections hide.
 */
@Component({
  selector: 'ui-hub',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <header class="hub-head">
      @if (config().icon) {
        <span class="hub-ic" [class]="config().tint || 'tint-orange'"><lucide-icon [name]="config().icon!" [size]="22" /></span>
      }
      <div>
        <h1 class="title">{{ config().title }}</h1>
        @if (config().subtitle) { <p class="crumb">{{ config().subtitle }}</p> }
      </div>
    </header>

    @for (s of visibleSections(); track s.title || $index) {
      @if (s.title) { <div class="sec">{{ s.title }}</div> }
      <div class="tiles">
        @for (t of s.tiles; track t.link) {
          <a class="card hover tile" [routerLink]="t.link">
            <span class="t-ic" [class]="t.tint || 'tint-orange'"><lucide-icon [name]="t.icon" [size]="20" /></span>
            <div class="t-body">
              <b>{{ t.label }}</b>
              <span>{{ t.desc }}</span>
            </div>
            <lucide-icon name="chevron-right" [size]="18" class="t-go" />
          </a>
        }
      </div>
    }
  `,
  styles: `
    .hub-head { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
    .hub-ic { width: 46px; height: 46px; flex: 0 0 auto; border-radius: 13px; display: grid; place-items: center; box-shadow: var(--shadow-sm); }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 3px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12.5px; margin: 0; }
    .sec { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-2); font-weight: 600; margin: 26px 0 12px; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .tile { display: flex; align-items: center; gap: 14px; padding: 18px; text-decoration: none; color: inherit; }
    .t-ic { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 12px; display: grid; place-items: center; box-shadow: var(--shadow-sm); }
    .t-body { min-width: 0; flex: 1; }
    .t-body b { display: block; font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em; }
    .t-body span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.45; }
    .t-go { color: var(--muted-2); flex: 0 0 auto; transition: 0.16s var(--ease); }
    .tile:hover .t-go { color: var(--brand); transform: translateX(2px); }
  `,
})
export class HubComponent {
  private readonly auth = inject(AuthService);
  readonly config = input.required<HubConfig>();

  readonly visibleSections = computed<HubSection[]>(() =>
    this.config()
      .sections.map((s) => ({ title: s.title, tiles: s.tiles.filter((t) => !t.perm || this.auth.can(t.perm!)) }))
      .filter((s) => s.tiles.length > 0),
  );
}
