import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';

import { InputComponent, TextareaComponent } from '../../shared/forms';
import { AuthService } from '../../core/auth.service';
import { ModerationApi } from '../../core/moderation.api';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import {
  AuthorHistory,
  AutoFlagSignal,
  ModerationActionRow,
  ReportDetail,
  ResolveAction,
  ResolveRequest,
} from '../../core/models';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, TitleCasePipe, IconComponent, TextareaComponent, InputComponent],
  template: `
    <a routerLink="/moderation/queue" class="back">‹ Back to queue</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (report(); as r) {
      <div class="dwrap">
        <!-- ── Col 1 · content + signals ───────────────────── -->
        <div class="dcol">
          <div class="card">
            <div class="card-h">
              <h3>Report #{{ r.id }} · {{ r.reason }}</h3>
              <span class="pill" [class]="statusClass(r.status)">
                {{ r.status | titlecase }}@if (isOpen(r.status)) { · {{ ageLabel(r.createdAt) }} }
              </span>
            </div>
            <div class="preview">
              <div class="ph">
                <span class="av">{{ initials(r) }}</span>
                <div class="who">
                  <b>{{ r.authorDisplayName || (r.authorUsername ? '@' + r.authorUsername : 'Unknown author') }}</b>
                  <span class="muted">
                    @if (r.authorUsername) { {{ '@' + r.authorUsername }} · }
                    {{ r.createdAt | date: 'MMM d, HH:mm' }} ·
                    {{ (r.privacy || r.contentType) | titlecase }}
                  </span>
                </div>
              </div>
              <p class="body">{{ r.snippet || '(content unavailable)' }}</p>
              @if (r.mediaCount > 0) {
                <div class="att"><lucide-icon name="image" [size]="14" /> {{ r.mediaCount }} attached {{ r.mediaCount === 1 ? 'item' : 'items' }}</div>
              }
            </div>
            <div class="rep">
              Reported by <b>{{ r.reporterCount }} {{ r.reporterCount === 1 ? 'user' : 'users' }}</b>
              · Reason: <b>{{ r.reason }}</b>
            </div>
            @if (r.details) { <div class="quote">“{{ r.details }}”@if (r.reporterUsername) { <span> — {{ '@' + r.reporterUsername }}</span> }</div> }
          </div>

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Auto-flag signals</h3><span class="hint">advisory only</span></div>
            @if (signals().length) {
              @for (s of signals(); track s.key) {
                <div class="sig">
                  <span class="ic" [class]="tint(s.severity)"><lucide-icon [name]="signalIcon(s.key)" [size]="14" /></span>
                  <span class="lab">{{ s.label }}</span>
                  <div class="meter"><i [style.width.%]="pct(s)" [style.background]="bar(s.severity)"></i></div>
                  <b>{{ value(s) }}</b>
                </div>
              }
              <div class="note" style="margin-top:14px">⚠ Advisory model output — never an automated decision. Every action below is your call and is logged.</div>
            } @else {
              <div class="empty">No automated signals for this report.</div>
            }
          </div>
        </div>

        <!-- ── Col 2 · author context ──────────────────────── -->
        <div class="dcol">
          @if (authorHistory(); as ah) {
            <div class="card">
              <div class="card-h"><h3>Author history</h3><span class="hint">{{ r.authorUsername ? '@' + r.authorUsername : '—' }}</span></div>
              <div class="ml">
                <div class="ln"><span>Account status</span><b><span class="pill" [class]="accountClass(ah.accountStatus || r.authorStatus)">{{ (ah.accountStatus || r.authorStatus) | titlecase }}</span></b></div>
                <div class="ln"><span>Prior sanctions</span><b [class.warn]="ah.recentSanctions.length > 0">{{ ah.recentSanctions.length }}</b></div>
                <div class="ln"><span>Open reports on author</span><b [class.warn]="ah.openReports > 0">{{ ah.openReports }}</b></div>
                <div class="ln"><span>Reports against (all-time)</span><b>{{ ah.reportsAgainst }}</b></div>
                <div class="ln"><span>Member since</span><b>{{ ah.memberSince ? (ah.memberSince | date: 'MMM y') : '—' }} · {{ ah.plan }}</b></div>
                <div class="ln"><span>Followers</span><b>{{ ah.followers | number }}</b></div>
              </div>
              @if (ah.recentSanctions.length) {
                <div class="subh">Recent sanctions</div>
                @for (s of ah.recentSanctions; track $index) {
                  <div class="srow">
                    <span class="pill" [class]="sanctionClass(s.type)">{{ s.type | titlecase }}</span>
                    <span class="muted grow">{{ s.reason || '—' }}</span>
                    <span class="when">{{ s.createdAt | date: 'MMM d, y' }}</span>
                  </div>
                }
              }
            </div>
          }

          <div class="card" style="margin-top:18px">
            <div class="card-h"><h3>Decision timeline</h3><span class="hint">moderation actions</span></div>
            @if (timeline().length) {
              <div class="timeline" style="margin-top:6px">
                @for (a of timeline(); track a.id) {
                  <div class="tl">
                    <div class="when">{{ a.createdAt | date: 'MMM d, HH:mm' }}</div>
                    <div class="what" style="display:flex;align-items:center;gap:8px;margin-top:4px">
                      <span class="pill" [class]="actionClass(a.action)">{{ a.action | titlecase }}</span>
                      <span class="muted">{{ a.reason || (a.targetType + ' #' + a.targetId) }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty">No actions recorded yet.</div>
            }
          </div>
        </div>

        <!-- ── Col 3 · action rail ─────────────────────────── -->
        <div class="dcol">
          @if (auth.can('GRIEVANCES:EDIT')) {
            <div class="card" style="margin-bottom:18px">
              <div class="card-h"><h3>Assignment</h3><span class="hint">{{ assigneeLabel(r) }}</span></div>
              <div class="acts">
                <button class="btn" (click)="assignMe()" [disabled]="busy()"><lucide-icon name="user-plus" [size]="15" /> Assign to me</button>
                @if (r.assigneeAdminId != null) {
                  <button class="btn" (click)="unassign()" [disabled]="busy()">Unassign</button>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-h"><h3>Take action</h3></div>
              <ui-textarea [rows]="3" placeholder="Rationale (recorded with the action)…" [(ngModel)]="reason" />
              <div class="acts">
                <button class="act ok" (click)="resolve('DISMISS')" [disabled]="busy()"><lucide-icon name="check" [size]="15" /> Dismiss — no violation</button>
                <button class="act warn" (click)="resolve('TAKEDOWN')" [disabled]="busy()"><lucide-icon name="flag" [size]="15" /> Take down content</button>
                <button class="act warn" (click)="resolve('WARN')" [disabled]="busy()"><lucide-icon name="mail" [size]="15" /> Warn author</button>
                <button class="act danger" (click)="resolve('SUSPEND')" [disabled]="busy()"><lucide-icon name="pause" [size]="15" /> Suspend author · 7d</button>
                <button class="act danger" (click)="resolve('BAN')" [disabled]="busy()"><lucide-icon name="ban" [size]="15" /> Ban author</button>
              </div>

              @if (r.contentType === 'POST') {
                <div class="region">
                  <div class="subh" style="margin-top:18px">Region-ban content</div>
                  <ui-input placeholder="Country (e.g. India)" [(ngModel)]="regionCountry" />
                  <button class="act" style="margin-top:9px" (click)="resolve('REGION_BAN')" [disabled]="busy()"><lucide-icon name="globe" [size]="15" /> Geo-restrict in country</button>
                </div>
              }
              <div class="note" style="margin-top:14px">⚠ Actions run via the internal hook on pacegrit-service and are written to the audit log.</div>
            </div>
          } @else {
            <div class="card"><div class="note">You have read-only access to grievances (no GRIEVANCES:EDIT).</div></div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .dwrap { display: grid; grid-template-columns: 1.3fr 1fr 360px; gap: 20px; align-items: start; }
    @media (max-width: 1380px) { .dwrap { grid-template-columns: 1fr 360px; } }
    @media (max-width: 1080px) { .dwrap { grid-template-columns: 1fr; } }
    .dcol { min-width: 0; }

    .preview { border: 1px solid var(--line); border-radius: 14px; padding: 18px; background: var(--surface-2); margin: 4px 0 14px; }
    .ph { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
    .av { width: 36px; height: 36px; border-radius: 10px; background: var(--av); display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: 0 0 auto; }
    .who { min-width: 0; } .who b { display: block; font-size: 14px; } .who .muted { font-size: 12px; }
    .body { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin: 0; }
    .att { display: inline-flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 11.5px; color: var(--muted); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 9px; }
    .rep { font-size: 12.5px; color: var(--muted); } .rep b { color: var(--ink); }
    .quote { margin-top: 12px; font-style: italic; color: var(--muted-2); border-left: 2px solid var(--brand-line); padding-left: 13px; font-size: 12.5px; line-height: 1.55; }

    /* auto-flag signal meters */
    .sig { display: flex; align-items: center; gap: 11px; padding: 9px 0; font-size: 12.5px; }
    .sig .ic { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto; box-shadow: var(--shadow-sm); }
    .sig .lab { width: 132px; flex: 0 0 auto; color: var(--ink-2); }
    .sig .meter { flex: 1; height: 7px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
    .sig .meter i { display: block; height: 100%; border-radius: 5px; }
    .sig b { width: 40px; text-align: right; font-variant-numeric: tabular-nums; }

    /* author meta-list */
    .ml .ln { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 12.5px; color: var(--muted); }
    .ml .ln:last-child { border-bottom: 0; }
    .ml .ln b { color: var(--ink); font-weight: 600; } .ml .ln b.warn { color: var(--rose); }
    .subh { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); font-weight: 600; margin: 16px 0 8px; }
    .srow { display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 12px; }
    .srow .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .srow .when { font-family: var(--mono); font-size: 10px; color: var(--muted-2); white-space: nowrap; }

    /* action rail */
    .acts { display: flex; flex-direction: column; gap: 9px; margin-top: 14px; }
    .act { display: flex; align-items: center; gap: 10px; text-align: left; width: 100%; padding: 11px 13px; border-radius: 11px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.15s var(--ease); font-family: inherit; }
    .act:hover:not(:disabled) { border-color: var(--line-strong); background: var(--card-hover); transform: translateX(2px); }
    .act:disabled { opacity: 0.5; cursor: default; }
    .act.ok:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
    .act.warn:hover:not(:disabled) { border-color: var(--amber); color: var(--amber); }
    .act.danger { color: var(--rose); } .act.danger:hover:not(:disabled) { border-color: var(--rose); background: rgba(244, 63, 94, 0.08); }
    .btn { display: flex; align-items: center; gap: 10px; }
    .region { border-top: 1px solid var(--line-soft); margin-top: 4px; }
  `,
})
export class ReportDetailComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly dir = inject(AdminDirectoryService);

  readonly report = signal<ReportDetail | null>(null);
  readonly timeline = signal<ModerationActionRow[]>([]);
  readonly authorHistory = signal<AuthorHistory | null>(null);
  readonly signals = signal<AutoFlagSignal[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  reason = '';
  regionCountry = '';

  ngOnInit(): void {
    this.dir.load();
    this.reload();
  }

  private reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.report(id).subscribe({
      next: (r) => this.report.set(r),
      error: () => this.error.set('Could not load this report.'),
    });
    this.api.timeline(id).subscribe({ next: (t) => this.timeline.set(t.items), error: () => {} });
    this.api.authorHistory(id).subscribe({ next: (h) => this.authorHistory.set(h), error: () => {} });
    this.api.signals(id).subscribe({ next: (s) => this.signals.set(s.items), error: () => {} });
  }

  assignMe(): void {
    const r = this.report();
    if (!r) return;
    this.busy.set(true);
    this.api.assign(r.id, { adminId: this.auth.me()?.id ?? null }).subscribe({
      next: () => { this.busy.set(false); this.reload(); },
      error: () => { this.busy.set(false); this.error.set('Could not assign.'); },
    });
  }

  unassign(): void {
    const r = this.report();
    if (!r) return;
    this.busy.set(true);
    this.api.assign(r.id, { adminId: null }).subscribe({
      next: () => { this.busy.set(false); this.reload(); },
      error: () => { this.busy.set(false); this.error.set('Could not unassign.'); },
    });
  }

  assigneeLabel(r: ReportDetail): string {
    if (r.assigneeAdminId == null) { return '—'; }
    return r.assigneeAdminId === this.auth.me()?.id ? 'you' : this.dir.name(r.assigneeAdminId);
  }

  resolve(action: ResolveAction): void {
    const r = this.report();
    if (!r) return;
    if (action === 'REGION_BAN' && !this.regionCountry.trim()) {
      this.error.set('Enter a country to region-ban this content.');
      return;
    }
    this.busy.set(true);
    const req: ResolveRequest = { action, reason: this.reason || undefined };
    if (action === 'REGION_BAN') { req.country = this.regionCountry.trim(); }
    this.api.resolve(r.id, req).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/moderation/queue']);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Action failed — check the admin API / internal hook.');
      },
    });
  }

  initials(r: ReportDetail): string {
    const src = r.authorDisplayName || r.authorUsername || '?';
    const parts = src.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || '?';
  }

  isOpen(s: string): boolean {
    return s === 'PENDING' || s === 'REVIEWING';
  }

  ageLabel(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) { return 'just now'; }
    const h = Math.floor(ms / 3600000);
    if (h >= 24) { return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'; }
    const m = Math.floor((ms % 3600000) / 60000);
    return h + 'h ' + m + 'm';
  }

  // auto-flag signal rendering
  pct(s: AutoFlagSignal): number {
    if (s.isBoolean) { return s.boolValue ? 100 : 6; }
    return s.score == null ? 0 : Math.round(s.score * 100);
  }

  value(s: AutoFlagSignal): string {
    if (s.isBoolean) { return s.boolValue ? 'yes' : 'no'; }
    return s.score == null ? '—' : s.score.toFixed(2);
  }

  tint(sev: string): string {
    switch (sev) {
      case 'HIGH': return 'tint-rose';
      case 'MED': return 'tint-amber';
      default: return 'tint-green';
    }
  }

  bar(sev: string): string {
    switch (sev) {
      case 'HIGH': return 'var(--rose)';
      case 'MED': return 'var(--amber)';
      default: return 'var(--green)';
    }
  }

  signalIcon(key: string): string {
    switch (key) {
      case 'targeted_mention': return 'at-sign';
      case 'nudity': case 'minor_safety': return 'shield-check';
      case 'external_links': return 'globe';
      default: return 'triangle-alert';
    }
  }

  statusClass(s: string): string {
    switch (s) {
      case 'PENDING': return 'pending';
      case 'REVIEWING': return 'review';
      case 'RESOLVED': return 'resolved';
      default: return 'dismissed';
    }
  }

  accountClass(s: string | null): string {
    switch (s) {
      case 'ACTIVE': return 'active';
      case 'SUSPENDED': return 'pending';
      case 'BANNED': return 'banned';
      default: return 'reason';
    }
  }

  sanctionClass(t: string): string {
    switch (t) {
      case 'BAN': return 'banned';
      case 'SUSPEND': return 'pending';
      case 'REINSTATE': return 'active';
      default: return 'reason';
    }
  }

  actionClass(a: string): string {
    switch (a) {
      case 'BAN': case 'TAKEDOWN': return 'banned';
      case 'SUSPEND': return 'pending';
      case 'WARN': return 'review';
      case 'DISMISS': return 'dismissed';
      default: return 'resolved';
    }
  }
}
