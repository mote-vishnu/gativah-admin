import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../../shared/icon';

import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';
import { ToastHostComponent } from '../../shared/toast/toast-host.component';
import { ConfirmHostComponent } from '../../shared/confirm/confirm-host.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';

const COLLAPSE_KEY = 'gativah-admin.nav-collapsed';

const TITLES: Record<string, string> = {
  home: 'Home',
  dashboard: 'Dashboard',
  users: 'Users',
  content: 'Content',
  billing: 'Billing Ops',
  clubs: 'Clubs',
  moderation: 'Grievances',
  finance: 'Finance',
  team: 'Staff & Roles',
  staff: 'Staff',
  roles: 'Roles & Permissions',
  legal: 'Legal & Disclosure',
  audit: 'Audit Log',
  security: 'Security',
  forbidden: 'Access denied',
};

// Friendly labels for the second path segment (sub-screens).
const SUB_TITLES: Record<string, string> = {
  posts: 'Posts & comments',
  stories: 'Stories',
  queue: 'Queue',
  appeals: 'Appeals',
  history: 'Moderation history',
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  subscriptions: 'Subscriptions',
  webhooks: 'Webhooks',
  entitlements: 'Entitlements',
  refunds: 'Refunds',
  staff: 'Staff',
  roles: 'Roles & Permissions',
};

interface NavChild {
  label: string;
  link: string;
  icon: string;
  perm?: string;
}
interface NavSection {
  title?: string;
  items: NavChild[];
}
interface NavModule {
  label: string;
  icon: string;
  match: string[]; // URL prefixes this module owns (a domain can span several route trees)
  sections: NavSection[];
}

// A handful of domain modules, each grouping related features into sections.
// The hub (/home) lists these modules; entering one shows its feature sidebar.
// Dashboard is intentionally NOT a module — it's a full-width overview.
const MODULES: NavModule[] = [
  {
    label: 'Overview', icon: 'layout-dashboard', match: ['/dashboard', '/insights'],
    sections: [
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', icon: 'layout-dashboard', link: '/dashboard' },
          { label: 'Insights', icon: 'chart-line', link: '/insights', perm: 'ANALYTICS:VIEW' },
        ],
      },
    ],
  },
  {
    label: 'Moderation', icon: 'flag', match: ['/moderation', '/content'],
    sections: [
      {
        title: 'Grievances',
        items: [
          { label: 'Queue', icon: 'flag', link: '/moderation/queue' },
          { label: 'Appeals', icon: 'scale', link: '/moderation/appeals', perm: 'APPEALS:VIEW' },
          { label: 'Region bans', icon: 'globe', link: '/moderation/region-bans' },
          { label: 'Moderation history', icon: 'scroll-text', link: '/moderation/history' },
        ],
      },
      {
        title: 'Content',
        items: [
          { label: 'Posts & comments', icon: 'message-square', link: '/content/posts', perm: 'CONTENT:VIEW' },
          { label: 'Stories', icon: 'image', link: '/content/stories', perm: 'CONTENT:VIEW' },
        ],
      },
    ],
  },
  {
    label: 'Finance', icon: 'dollar-sign', match: ['/finance', '/billing'],
    sections: [
      {
        title: 'Revenue',
        items: [
          { label: 'Dashboard', icon: 'layout-dashboard', link: '/finance/dashboard' },
          { label: 'Transactions', icon: 'receipt-text', link: '/finance/transactions' },
          { label: 'Subscriptions', icon: 'dollar-sign', link: '/finance/subscriptions' },
          { label: 'Webhooks', icon: 'webhook', link: '/finance/webhooks' },
        ],
      },
      {
        title: 'Billing',
        items: [
          { label: 'Entitlements', icon: 'credit-card', link: '/billing/entitlements', perm: 'BILLING:VIEW' },
          { label: 'Refunds', icon: 'receipt-text', link: '/billing/refunds', perm: 'BILLING:VIEW' },
        ],
      },
    ],
  },
  {
    label: 'Community', icon: 'users-round', match: ['/users', '/clubs'],
    sections: [
      { title: 'Members', items: [{ label: 'Directory', icon: 'users', link: '/users', perm: 'USERS:VIEW' }] },
      { title: 'Clubs', items: [{ label: 'Directory', icon: 'users-round', link: '/clubs', perm: 'CLUBS:VIEW' }] },
    ],
  },
  {
    label: 'Legal & Disclosure', icon: 'scale', match: ['/legal'],
    sections: [{ items: [{ label: 'Requests', icon: 'scale', link: '/legal', perm: 'LEGAL:VIEW' }] }],
  },
  {
    label: 'Platform', icon: 'shield-check', match: ['/team', '/audit', '/security', '/privacy'],
    sections: [
      {
        title: 'Team',
        items: [
          { label: 'Staff', icon: 'users', link: '/team/staff', perm: 'STAFF:VIEW' },
          { label: 'Roles & Permissions', icon: 'shield-check', link: '/team/roles', perm: 'ROLES:VIEW' },
        ],
      },
      {
        title: 'Privacy & data',
        items: [
          { label: 'DSAR & Erasure', icon: 'shield-check', link: '/privacy', perm: 'PRIVACY:VIEW' },
        ],
      },
      {
        title: 'System',
        items: [
          { label: 'Audit log', icon: 'scroll-text', link: '/audit' },
          { label: 'Security', icon: 'shield-check', link: '/security' },
        ],
      },
    ],
  },
];

interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ToastHostComponent, ConfirmHostComponent, CommandPaletteComponent],
  template: `
    <div class="shell" [class.collapsed]="collapsed()" [class.no-rail]="!mod()" [class.home]="isHome()">
      @if (mod(); as m) {
        <aside class="sidebar">
          <a class="logo" routerLink="/home">
            <span class="mark">G</span>
            <span class="name">Gativah<small>Admin Console</small></span>
          </a>

          <nav class="home-nav">
            <a routerLink="/home" title="All modules"><lucide-icon name="chevron-left" [size]="17" /> <span class="lbl">All modules</span></a>
          </nav>
          <div class="mod-title"><lucide-icon [name]="m.icon" [size]="16" /> <span class="lbl">{{ m.label }}</span></div>

          <div class="nav-scroll">
            @for (s of visibleSections(m); track $index) {
              @if (s.title) { <div class="group">{{ s.title }}</div> }
              <nav>
                @for (it of s.items; track it.link) {
                  <a [routerLink]="it.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" [title]="it.label">
                    <lucide-icon [name]="it.icon" [size]="17" /> <span class="lbl">{{ it.label }}</span>
                  </a>
                }
              </nav>
            }
          </div>

          <div class="who">
            <span class="avatar">{{ initials() }}</span>
            <span class="meta">
              <b>{{ auth.me()?.name }}</b>
              <span>{{ auth.me()?.email }}</span>
              <span class="role">{{ (auth.me()?.roles ?? []).join(' · ') }}</span>
            </span>
          </div>
        </aside>
      }

      <main>
        <header class="topbar">
          @if (mod()) {
            <button class="icon-btn" (click)="toggleCollapse()" title="Toggle sidebar"><lucide-icon name="panel-left" [size]="17" /></button>
          } @else {
            <a class="brand" routerLink="/home"><span class="mark">G</span> <span>Gativah Admin</span></a>
          }
          <nav class="crumbs">
            @for (c of crumbs(); track $index; let last = $last) {
              @if (!last && c.link) {
                <a [routerLink]="c.link">{{ c.label }}</a>
                <span class="sep">/</span>
              } @else {
                <b>{{ c.label }}</b>
              }
            }
          </nav>
          <div class="spacer"></div>
          <button class="cmdk" (click)="palette.toggle()" title="Search pages (Ctrl/⌘ K)">
            <lucide-icon name="search" [size]="15" /> <span>Search…</span> <kbd>⌘K</kbd>
          </button>
          <a class="icon-btn" routerLink="/security" routerLinkActive="on" title="Security / MFA"><lucide-icon name="shield-check" [size]="17" /></a>
          <button class="icon-btn" title="Notifications"><lucide-icon name="bell" [size]="17" /></button>
          <button class="icon-btn" (click)="theme.toggle()" title="Toggle theme">
            <lucide-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" [size]="17" />
          </button>
          <button class="btn" (click)="auth.logout()"><lucide-icon name="log-out" [size]="15" /> Sign out</button>
        </header>
        <div class="content"><router-outlet /></div>
      </main>

      <ui-toast-host />
      <ui-confirm-host />
      <ui-command-palette #palette />
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; transition: grid-template-columns 0.2s var(--ease); }
    .shell.collapsed { grid-template-columns: 76px 1fr; }
    .shell.no-rail { grid-template-columns: 1fr; }
    .nav-scroll { display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; }
    .mod-title { display: flex; align-items: center; gap: 9px; font-family: var(--sans); font-weight: 700; font-size: 14px; color: #fff; padding: 8px 12px 12px; white-space: nowrap; }
    .mod-title lucide-icon { color: var(--brand); flex: 0 0 auto; }
    .brand { display: inline-flex; align-items: center; gap: 9px; font-family: var(--sans); font-weight: 700; font-size: 15px; color: var(--ink); text-decoration: none; }
    .brand .mark { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; color: #fff; font-size: 15px; }
    .shell.home .content { max-width: 1100px; margin: 0 auto; width: 100%; }
    .sidebar {
      --ink: #fafafa; --muted: #a1a1aa; --muted-2: #6b6b73;
      --line: #262a2e; --line-soft: #1c1c20; --surface-2: #1b1b1f;
      background: rgba(10, 10, 12, 0.96); border-right: 1px solid var(--line);
      padding: 22px 16px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; color: var(--ink); overflow: hidden;
    }
    .logo { display: flex; align-items: center; gap: 11px; padding: 6px 8px 22px; text-decoration: none; cursor: pointer; }
    .mark { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; font-family: var(--sans); font-weight: 800; color: #fff; font-size: 18px; }
    .name { font-family: var(--sans); font-weight: 700; font-size: 17px; line-height: 1; color: #fff; white-space: nowrap; }
    .name small { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted-2); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
    .group { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-2); padding: 16px 12px 7px; white-space: nowrap; }
    .sidebar nav { display: flex; flex-direction: column; gap: 3px; }
    .sidebar nav a { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--r-sm); color: var(--muted); font-size: 13.5px; font-weight: 500; transition: 0.16s var(--ease); white-space: nowrap; }
    .sidebar nav a lucide-icon { display: inline-flex; flex: 0 0 auto; opacity: 0.9; }
    .sidebar nav a:hover { background: var(--surface-2); color: var(--ink); transform: translateX(2px); }
    .sidebar nav a.active { color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand-line); }
    .sidebar nav a.active::before { content: ""; position: absolute; left: -8px; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; border-radius: 0 3px 3px 0; background: var(--brand); }
    .shell.collapsed .sidebar nav a:hover { transform: none; }
    .shell.collapsed .sidebar nav a.active::before { left: -12px; }
    .home-nav { margin-bottom: 4px; }
    .home-nav a { color: var(--muted-2); }
    .who { margin-top: auto; border-top: 1px solid var(--line-soft); padding-top: 16px; display: flex; align-items: center; gap: 11px; }
    .avatar { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; background: linear-gradient(135deg, #3f3f46, #27272a); display: grid; place-items: center; font-weight: 700; font-size: 13px; }
    .meta { line-height: 1.35; min-width: 0; }
    .meta b { font-size: 13px; display: block; }
    .meta span { display: block; font-size: 11px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; }
    .role { font-family: var(--mono); font-size: 9px !important; color: var(--brand) !important; margin-top: 3px; }

    /* collapsed rail */
    .shell.collapsed .sidebar { padding: 22px 12px; }
    .shell.collapsed .name, .shell.collapsed .group, .shell.collapsed .lbl, .shell.collapsed .meta { display: none; }
    .shell.collapsed .logo { justify-content: center; padding: 6px 0 22px; }
    .shell.collapsed .sidebar nav a { justify-content: center; gap: 0; padding: 11px; }
    .shell.collapsed .who { justify-content: center; }
    .shell.collapsed .mod-title { justify-content: center; padding: 8px 0 12px; }
    .shell.collapsed .home-nav a { justify-content: center; gap: 0; padding: 11px; }

    main { min-width: 0; }
    .topbar { display: flex; align-items: center; gap: 12px; padding: 12px 30px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--glass); backdrop-filter: blur(16px); z-index: 10; }
    .crumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted-2); min-width: 0; }
    .crumbs a { color: var(--muted-2); } .crumbs a:hover { color: var(--ink); }
    .crumbs .sep { opacity: 0.5; }
    .crumbs b { color: var(--ink); font-weight: 600; white-space: nowrap; }
    .icon-btn { width: 38px; height: 38px; flex: 0 0 auto; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); display: grid; place-items: center; cursor: pointer; transition: 0.15s var(--ease); }
    .icon-btn:hover { color: var(--ink); border-color: var(--line-strong); }
    .icon-btn.on { color: var(--brand); border-color: var(--brand-line); }
    .cmdk { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line); color: var(--muted-2); cursor: pointer; font-family: inherit; font-size: 13px; transition: 0.15s var(--ease); }
    .cmdk:hover { color: var(--ink); border-color: var(--line-strong); }
    .cmdk span { white-space: nowrap; }
    .cmdk kbd { font-family: var(--mono); font-size: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 5px; padding: 2px 5px; }
    @media (max-width: 720px) { .cmdk span { display: none; } }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .content { padding: 26px 30px 80px; min-width: 0; }
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly collapsed = signal(localStorage.getItem(COLLAPSE_KEY) === '1');
  readonly url = signal(this.router.url);
  readonly crumbs = signal<Crumb[]>(crumbsFor(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.crumbs.set(crumbsFor(e.urlAfterRedirects));
      });
  }

  /**
   * The module the current route belongs to, or null on the hub / utility
   * screens. When null the sidebar is hidden and the hub renders full-width;
   * otherwise the sidebar shows that module's feature sections.
   */
  isHome(): boolean {
    return this.url().split('?')[0] === '/home';
  }

  mod(): NavModule | null {
    const u = this.url().split('?')[0];
    for (const m of MODULES) {
      if (m.match.some((p) => u === p || u.startsWith(p + '/'))) {
        return m;
      }
    }
    return null;
  }

  visibleSections(m: NavModule): NavSection[] {
    return m.sections
      .map((s) => ({ title: s.title, items: s.items.filter((it) => !it.perm || this.auth.can(it.perm)) }))
      .filter((s) => s.items.length > 0);
  }

  toggleCollapse(): void {
    this.collapsed.update((v) => !v);
    localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
  }

  initials(): string {
    const name = this.auth.me()?.name ?? '?';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}

function crumbsFor(url: string): Crumb[] {
  const segs = url.split('?')[0].split('/').filter(Boolean);
  // Home is the root landing — show it alone.
  if (segs.length === 0 || segs[0] === 'home') {
    return [{ label: 'Home' }];
  }
  const section = segs[0];
  const sectionLabel = TITLES[section] ?? capitalize(section);
  const trail: Crumb[] = [{ label: 'Home', link: '/home' }];

  if (segs.length > 1) {
    // Deeper route (e.g. /moderation/queue, /finance/transactions, /moderation/123).
    trail.push({ label: sectionLabel, link: '/' + section });
    const sub = segs[1];
    trail.push({ label: /^\d+$/.test(sub) ? '#' + sub : (SUB_TITLES[sub] ?? capitalize(sub)) });
  } else {
    trail.push({ label: sectionLabel });
  }
  return trail;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}
