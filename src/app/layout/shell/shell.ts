import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo"><span class="mark">G</span><span class="name">Gativah<small>Admin Console</small></span></div>

        <div class="group">Operations</div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active"><span class="ic">◧</span> Dashboard</a>
          <a routerLink="/moderation" routerLinkActive="active"><span class="ic">⚑</span> Grievances</a>
          <a routerLink="/finance" routerLinkActive="active"><span class="ic">＄</span> Finance</a>
        </nav>

        <div class="group">Platform</div>
        <nav>
          <a routerLink="/staff" routerLinkActive="active"><span class="ic">⚇</span> Staff &amp; Roles</a>
          <a routerLink="/audit" routerLinkActive="active"><span class="ic">❡</span> Audit Log</a>
        </nav>

        <div class="who">
          <span class="avatar">{{ initials() }}</span>
          <span class="meta">
            <b>{{ auth.me()?.name }}</b>
            <span>{{ auth.me()?.email }}</span>
            <span class="role">{{ auth.me()?.role }}</span>
          </span>
        </div>
      </aside>

      <main>
        <header class="topbar">
          <div class="spacer"></div>
          <button class="btn" (click)="theme.toggle()">{{ theme.theme() === 'dark' ? '☾' : '☀' }}</button>
          <button class="btn" (click)="auth.logout()">Sign out</button>
        </header>
        <div class="content"><router-outlet /></div>
      </main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    /* sidebar stays dark in BOTH themes */
    .sidebar {
      --ink: #fafafa; --muted: #a1a1aa; --muted-2: #6b6b73;
      --line: #262a2e; --line-soft: #1c1c20; --surface-2: #1b1b1f;
      background: rgba(10, 10, 12, 0.96); border-right: 1px solid var(--line);
      padding: 22px 16px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; color: var(--ink);
    }
    .logo { display: flex; align-items: center; gap: 11px; padding: 6px 8px 22px; }
    .mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--brand), var(--brand-3)); display: grid; place-items: center; font-family: var(--disp); font-weight: 800; color: #fff; font-size: 18px; }
    .name { font-family: var(--disp); font-weight: 700; font-size: 17px; line-height: 1; color: #fff; }
    .name small { display: block; font-family: var(--mono); font-size: 9px; color: var(--muted-2); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
    .group { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-2); padding: 16px 12px 7px; }
    nav { display: flex; flex-direction: column; gap: 3px; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--r-sm); color: var(--muted); font-size: 13.5px; font-weight: 500; transition: 0.15s var(--ease); }
    nav a:hover { background: var(--surface-2); color: var(--ink); }
    nav a.active { color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand-line); }
    .ic { width: 18px; text-align: center; font-size: 15px; }
    .who { margin-top: auto; border-top: 1px solid var(--line-soft); padding-top: 16px; display: flex; align-items: center; gap: 11px; }
    .avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #3f3f46, #27272a); display: grid; place-items: center; font-weight: 700; font-size: 13px; }
    .meta { line-height: 1.35; }
    .meta b { font-size: 13px; display: block; }
    .meta span { display: block; font-size: 11px; color: var(--muted-2); }
    .role { font-family: var(--mono); font-size: 9px !important; color: var(--brand) !important; margin-top: 3px; }
    main { min-width: 0; }
    .topbar { display: flex; align-items: center; gap: 10px; padding: 16px 30px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--glass); backdrop-filter: blur(16px); z-index: 10; }
    .content { padding: 26px 30px 80px; }
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  initials(): string {
    const name = this.auth.me()?.name ?? '?';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
