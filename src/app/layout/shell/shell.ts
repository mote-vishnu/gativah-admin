import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../../shared/icon';

import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

const COLLAPSE_KEY = 'gativah-admin.nav-collapsed';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  moderation: 'Grievances',
  finance: 'Finance',
  staff: 'Staff',
  roles: 'Roles & Permissions',
  legal: 'Legal & Disclosure',
  audit: 'Audit Log',
  security: 'Security',
  forbidden: 'Access denied',
};

interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="shell" [class.collapsed]="collapsed()">
      <aside class="sidebar">
        <div class="logo">
          <span class="mark">G</span>
          <span class="name">Gativah<small>Admin Console</small></span>
        </div>

        <div class="group">Operations</div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" title="Dashboard"><lucide-icon name="layout-dashboard" [size]="17" /> <span class="lbl">Dashboard</span></a>
          @if (auth.can('GRIEVANCES:VIEW')) {
            <a routerLink="/moderation" routerLinkActive="active" title="Grievances"><lucide-icon name="flag" [size]="17" /> <span class="lbl">Grievances</span></a>
          }
          @if (auth.can('FINANCE:VIEW')) {
            <a routerLink="/finance" routerLinkActive="active" title="Finance"><lucide-icon name="dollar-sign" [size]="17" /> <span class="lbl">Finance</span></a>
          }
        </nav>

        <div class="group">Platform</div>
        <nav>
          @if (auth.can('STAFF:VIEW')) {
            <a routerLink="/staff" routerLinkActive="active" title="Staff"><lucide-icon name="users" [size]="17" /> <span class="lbl">Staff</span></a>
          }
          @if (auth.can('ROLES:VIEW')) {
            <a routerLink="/roles" routerLinkActive="active" title="Roles &amp; Permissions"><lucide-icon name="shield-check" [size]="17" /> <span class="lbl">Roles &amp; Permissions</span></a>
          }
          @if (auth.can('LEGAL:VIEW')) {
            <a routerLink="/legal" routerLinkActive="active" title="Legal &amp; Disclosure"><lucide-icon name="scale" [size]="17" /> <span class="lbl">Legal &amp; Disclosure</span></a>
          }
          <a routerLink="/audit" routerLinkActive="active" title="Audit Log"><lucide-icon name="scroll-text" [size]="17" /> <span class="lbl">Audit Log</span></a>
        </nav>

        <div class="who">
          <span class="avatar">{{ initials() }}</span>
          <span class="meta">
            <b>{{ auth.me()?.name }}</b>
            <span>{{ auth.me()?.email }}</span>
            <span class="role">{{ (auth.me()?.roles ?? []).join(' · ') }}</span>
          </span>
        </div>
      </aside>

      <main>
        <header class="topbar">
          <button class="icon-btn" (click)="toggleCollapse()" title="Toggle sidebar"><lucide-icon name="panel-left" [size]="17" /></button>
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
          <a class="icon-btn" routerLink="/security" routerLinkActive="on" title="Security / MFA"><lucide-icon name="shield-check" [size]="17" /></a>
          <button class="icon-btn" title="Notifications"><lucide-icon name="bell" [size]="17" /></button>
          <button class="icon-btn" (click)="theme.toggle()" title="Toggle theme">
            <lucide-icon [name]="theme.theme() === 'dark' ? 'moon' : 'sun'" [size]="17" />
          </button>
          <button class="btn" (click)="auth.logout()"><lucide-icon name="log-out" [size]="15" /> Sign out</button>
        </header>
        <div class="content"><router-outlet /></div>
      </main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; transition: grid-template-columns 0.2s var(--ease); }
    .shell.collapsed { grid-template-columns: 76px 1fr; }
    .sidebar {
      --ink: #fafafa; --muted: #a1a1aa; --muted-2: #6b6b73;
      --line: #262a2e; --line-soft: #1c1c20; --surface-2: #1b1b1f;
      background: rgba(10, 10, 12, 0.96); border-right: 1px solid var(--line);
      padding: 22px 16px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; color: var(--ink); overflow: hidden;
    }
    .logo { display: flex; align-items: center; gap: 11px; padding: 6px 8px 22px; }
    .mark { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; font-family: var(--sans); font-weight: 800; color: #fff; font-size: 18px; }
    .name { font-family: var(--sans); font-weight: 700; font-size: 17px; line-height: 1; color: #fff; white-space: nowrap; }
    .name small { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted-2); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
    .group { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-2); padding: 16px 12px 7px; white-space: nowrap; }
    .sidebar nav { display: flex; flex-direction: column; gap: 3px; }
    .sidebar nav a { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: var(--r-sm); color: var(--muted); font-size: 13.5px; font-weight: 500; transition: 0.15s var(--ease); white-space: nowrap; }
    .sidebar nav a lucide-icon { display: inline-flex; flex: 0 0 auto; opacity: 0.9; }
    .sidebar nav a:hover { background: var(--surface-2); color: var(--ink); }
    .sidebar nav a.active { color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand-line); }
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

    main { min-width: 0; }
    .topbar { display: flex; align-items: center; gap: 12px; padding: 12px 30px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--glass); backdrop-filter: blur(16px); z-index: 10; }
    .crumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted-2); min-width: 0; }
    .crumbs a { color: var(--muted-2); } .crumbs a:hover { color: var(--ink); }
    .crumbs .sep { opacity: 0.5; }
    .crumbs b { color: var(--ink); font-weight: 600; white-space: nowrap; }
    .icon-btn { width: 38px; height: 38px; flex: 0 0 auto; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); display: grid; place-items: center; cursor: pointer; transition: 0.15s var(--ease); }
    .icon-btn:hover { color: var(--ink); border-color: var(--line-strong); }
    .icon-btn.on { color: var(--brand); border-color: var(--brand-line); }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .content { padding: 26px 30px 80px; min-width: 0; }
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly collapsed = signal(localStorage.getItem(COLLAPSE_KEY) === '1');
  readonly crumbs = signal<Crumb[]>(crumbsFor(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((e) => this.crumbs.set(crumbsFor(e.urlAfterRedirects)));
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
  // Dashboard is the root — show it alone, no redundant "Home /".
  if (segs.length === 0 || segs[0] === 'dashboard') {
    return [{ label: 'Dashboard' }];
  }
  const section = segs[0];
  const sectionLabel = TITLES[section] ?? capitalize(section);
  const trail: Crumb[] = [{ label: 'Dashboard', link: '/dashboard' }];

  if (segs.length > 1) {
    // Deeper route (e.g. /moderation/123) — section becomes a link, detail is the leaf.
    trail.push({ label: sectionLabel, link: '/' + section });
    const sub = segs[1];
    trail.push({ label: /^\d+$/.test(sub) ? '#' + sub : capitalize(sub) });
  } else {
    trail.push({ label: sectionLabel });
  }
  return trail;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}
