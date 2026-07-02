import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from '../icon';

export type HeaderTint = 'orange' | 'cyan' | 'green' | 'rose' | 'violet' | 'amber';

/**
 * Premium page header — a tinted icon tile + title (with optional count pill) +
 * subtitle, and a right-aligned actions slot. The tint draws from the design
 * system palette (reuses the global .tint-* classes) so each section gets its
 * own accent colour.
 *   <ui-page-header icon="users" title="Users" subtitle="…" [count]="n" tint="cyan">
 *     <button page-actions class="btn primary">…</button>
 *   </ui-page-header>
 */
@Component({
  selector: 'ui-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="ph rise" [class]="'accent-' + tint()">
      <div class="ph-left">
        @if (icon()) {
          <span class="ph-icon" [class]="'tint-' + tint()"><lucide-icon [name]="icon()" [size]="20" /></span>
        }
        <div class="ph-text">
          @if (eyebrow()) { <div class="ph-eyebrow">{{ eyebrow() }}</div> }
          <h1 class="ph-title">
            {{ title() }}
            @if (count() !== null) { <span class="ph-count">{{ count() }}</span> }
          </h1>
          @if (subtitle()) { <p class="ph-sub">{{ subtitle() }}</p> }
        </div>
      </div>
      <div class="ph-actions"><ng-content select="[page-actions]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ph { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    /* Ambient accent glow, tinted per section — subtle, non-interactive. */
    .ph::before { content: ''; position: absolute; left: -8px; top: -30px; width: 240px; height: 120px; pointer-events: none;
      background: radial-gradient(60% 80% at 20% 30%, var(--ph-accent), transparent 70%); opacity: 0.5; filter: blur(6px); z-index: 0; }
    .ph-left, .ph-actions { position: relative; z-index: 1; }
    .ph-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .ph-icon { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; flex: 0 0 auto; box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.06); }
    .ph-text { min-width: 0; }
    .ph-eyebrow { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--ph-fg); margin-bottom: 3px; }
    .ph-title { font-family: var(--disp); font-weight: 800; font-size: 22px; margin: 0; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .ph-count { font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; }
    .ph-sub { color: var(--muted-2); font-size: 12.5px; margin: 3px 0 0; }
    .ph-actions { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }

    /* Per-tint accent colour driving the glow + eyebrow. */
    .accent-orange { --ph-accent: rgba(249,115,22,0.16); --ph-fg: var(--brand); }
    .accent-cyan   { --ph-accent: rgba(6,182,212,0.15);  --ph-fg: var(--cyan); }
    .accent-green  { --ph-accent: rgba(34,197,94,0.15);  --ph-fg: var(--green); }
    .accent-rose   { --ph-accent: rgba(244,63,94,0.15);  --ph-fg: var(--rose); }
    .accent-violet { --ph-accent: rgba(139,92,246,0.16); --ph-fg: var(--violet); }
    .accent-amber  { --ph-accent: rgba(234,179,8,0.15);  --ph-fg: var(--amber); }

    .rise { animation: ph-rise 0.4s var(--ease) both; }
    @keyframes ph-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
  `,
})
export class PageHeaderComponent {
  readonly icon = input('');
  readonly eyebrow = input('');
  readonly title = input('');
  readonly subtitle = input('');
  readonly count = input<number | null>(null);
  readonly tint = input<HeaderTint>('orange');
}
