import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../icon';

interface PaletteItem {
  label: string;
  path: string;
  category: string;
  icon: string;
  perm?: string;
  keywords?: string;
}

interface PaletteGroup {
  category: string;
  items: { item: PaletteItem; index: number }[];
}

// Every navigable page, grouped. Permission-gated entries are filtered per user.
const ITEMS: PaletteItem[] = [
  { label: 'Home', path: '/home', category: 'General', icon: 'layout-dashboard', keywords: 'hub modules' },
  { label: 'Dashboard', path: '/dashboard', category: 'General', icon: 'layout-dashboard', keywords: 'overview kpi' },

  { label: 'Grievance queue', path: '/moderation/queue', category: 'Moderation', icon: 'flag', keywords: 'reports moderation' },
  { label: 'Appeals', path: '/moderation/appeals', category: 'Moderation', icon: 'scale', perm: 'APPEALS:VIEW' },
  { label: 'Region bans', path: '/moderation/region-bans', category: 'Moderation', icon: 'globe' },
  { label: 'Moderation history', path: '/moderation/history', category: 'Moderation', icon: 'scroll-text' },
  { label: 'Posts & comments', path: '/content/posts', category: 'Moderation', icon: 'message-square', perm: 'CONTENT:VIEW', keywords: 'content' },
  { label: 'Stories', path: '/content/stories', category: 'Moderation', icon: 'image', perm: 'CONTENT:VIEW', keywords: 'content' },

  { label: 'Finance dashboard', path: '/finance/dashboard', category: 'Finance', icon: 'dollar-sign', keywords: 'revenue mrr' },
  { label: 'Transactions', path: '/finance/transactions', category: 'Finance', icon: 'receipt-text' },
  { label: 'Subscriptions', path: '/finance/subscriptions', category: 'Finance', icon: 'dollar-sign' },
  { label: 'Webhooks', path: '/finance/webhooks', category: 'Finance', icon: 'webhook' },
  { label: 'Entitlements', path: '/billing/entitlements', category: 'Finance', icon: 'credit-card', perm: 'BILLING:VIEW', keywords: 'billing comp' },
  { label: 'Refunds', path: '/billing/refunds', category: 'Finance', icon: 'receipt-text', perm: 'BILLING:VIEW', keywords: 'billing' },

  { label: 'Users directory', path: '/users', category: 'Community', icon: 'users', perm: 'USERS:VIEW', keywords: 'members people' },
  { label: 'Clubs', path: '/clubs', category: 'Community', icon: 'users-round', perm: 'CLUBS:VIEW' },

  { label: 'Legal & Disclosure', path: '/legal', category: 'Governance', icon: 'scale', perm: 'LEGAL:VIEW', keywords: 'subpoena warrant disclosure' },
  { label: 'Staff', path: '/team/staff', category: 'Governance', icon: 'users', perm: 'STAFF:VIEW' },
  { label: 'Roles & Permissions', path: '/team/roles', category: 'Governance', icon: 'shield-check', perm: 'ROLES:VIEW' },
  { label: 'Audit log', path: '/audit', category: 'Governance', icon: 'scroll-text' },
  { label: 'Security / MFA', path: '/security', category: 'Governance', icon: 'shield-check' },
];

/**
 * Cmd/Ctrl-K command palette — fuzzy page navigation across the console. Mounted
 * once in the shell; opens on the global shortcut. Items are permission-filtered.
 */
@Component({
  selector: 'ui-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (open()) {
      <div class="cp-scrim" (click)="close()">
        <div class="cp" role="dialog" aria-modal="true" aria-label="Search pages" (click)="$event.stopPropagation()">
          <div class="cp-in">
            <lucide-icon name="search" [size]="18" />
            <input #box type="text" placeholder="Search pages…" [value]="query()"
                   (input)="onInput($event)" (keydown)="onKey($event)" aria-label="Search pages" />
            <kbd>esc</kbd>
          </div>
          <div class="cp-body">
            @for (g of groups(); track g.category) {
              <div class="cp-cat">{{ g.category }}</div>
              @for (row of g.items; track row.item.path) {
                <button type="button" class="cp-row" [class.active]="row.index === active()"
                        (click)="go(row.item)" (mouseenter)="active.set(row.index)">
                  <lucide-icon [name]="row.item.icon" [size]="16" />
                  <span class="lbl">{{ row.item.label }}</span>
                  <span class="path">{{ row.item.path }}</span>
                </button>
              }
            } @empty {
              <div class="cp-empty">No pages match “{{ query() }}”.</div>
            }
          </div>
          <div class="cp-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><lucide-icon name="corner-down-left" [size]="12" /> open</span>
            <span class="hint">Search the console</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .cp-scrim { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; animation: fade 0.12s ease; }
    @keyframes fade { from { opacity: 0; } }
    .cp { width: 580px; max-width: 92vw; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow); overflow: hidden; animation: rise 0.14s var(--ease); }
    @keyframes rise { from { opacity: 0; transform: translateY(-8px); } }
    .cp-in { display: flex; align-items: center; gap: 11px; padding: 15px 18px; border-bottom: 1px solid var(--line); }
    .cp-in lucide-icon { color: var(--muted-2); flex: 0 0 auto; }
    .cp-in input { flex: 1; border: 0; background: transparent; outline: none; color: var(--ink); font-family: inherit; font-size: 16px; }
    .cp-in input::placeholder { color: var(--muted-2); }
    kbd { font-family: var(--mono); font-size: 10px; color: var(--muted-2); background: var(--surface-2); border: 1px solid var(--line); border-radius: 5px; padding: 2px 6px; }
    .cp-body { max-height: 50vh; overflow-y: auto; padding: 7px; }
    .cp-cat { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-2); padding: 12px 12px 5px; }
    .cp-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 0; background: transparent; border-radius: 10px; cursor: pointer; color: var(--ink-2); font-family: inherit; font-size: 14px; text-align: left; }
    .cp-row lucide-icon { color: var(--muted-2); flex: 0 0 auto; }
    .cp-row .lbl { flex: 1; color: var(--ink); }
    .cp-row .path { font-family: var(--mono); font-size: 11px; color: var(--muted-2); }
    .cp-row.active { background: var(--brand-soft); box-shadow: inset 0 0 0 1px var(--brand-line); }
    .cp-row.active lucide-icon, .cp-row.active .path { color: var(--brand); }
    .cp-empty { padding: 28px; text-align: center; color: var(--muted-2); font-size: 13px; }
    .cp-foot { display: flex; align-items: center; gap: 16px; padding: 10px 18px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted-2); }
    .cp-foot span { display: inline-flex; align-items: center; gap: 5px; }
    .cp-foot .hint { margin-left: auto; }
  `,
})
export class CommandPaletteComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly open = signal(false);
  readonly query = signal('');
  readonly active = signal(0);

  private readonly allowed = computed(() => ITEMS.filter((i) => !i.perm || this.auth.can(i.perm)));

  /** Flat, permission- and query-filtered list (drives keyboard nav). */
  private readonly flat = computed(() => {
    const q = this.query().trim().toLowerCase();
    const items = this.allowed();
    if (!q) { return items; }
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.keywords ?? '').includes(q) ||
      i.path.includes(q));
  });

  readonly groups = computed<PaletteGroup[]>(() => {
    const out: PaletteGroup[] = [];
    this.flat().forEach((item, index) => {
      let g = out.find((x) => x.category === item.category);
      if (!g) { g = { category: item.category, items: [] }; out.push(g); }
      g.items.push({ item, index });
    });
    return out;
  });

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.toggle();
    } else if (e.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  toggle(): void {
    this.open() ? this.close() : this.openPalette();
  }

  private openPalette(): void {
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    setTimeout(() => (document.querySelector('.cp-in input') as HTMLInputElement | null)?.focus(), 0);
  }

  close(): void { this.open.set(false); }

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.flat().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { this.active.set((this.active() + 1) % n); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { this.active.set((this.active() - 1 + n) % n); } }
    else if (e.key === 'Enter') { e.preventDefault(); const it = this.flat()[this.active()]; if (it) { this.go(it); } }
  }

  go(item: PaletteItem): void {
    this.close();
    void this.router.navigate([item.path]);
  }
}
