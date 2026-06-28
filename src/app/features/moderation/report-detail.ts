import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';

import { TextareaComponent } from '../../shared/forms';
import { AuthService } from '../../core/auth.service';
import { ModerationApi } from '../../core/moderation.api';
import { ReportDetail, ResolveAction } from '../../core/models';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, TitleCasePipe, IconComponent, TextareaComponent],
  template: `
    <a routerLink="/moderation" class="back">‹ Back to queue</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (report(); as r) {
      <div class="grid">
        <div>
          <div class="card">
            <div class="card-h">
              <h3>Report #{{ r.id }} · {{ r.reason }}</h3>
              <span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span>
            </div>
            <div class="preview">
              <div class="ph">
                <span class="av">{{ (r.authorUsername || '?').slice(0, 2).toUpperCase() }}</span>
                <div>
                  <b>{{ r.authorUsername ? '@' + r.authorUsername : 'Unknown author' }}</b>
                  <span class="muted">{{ r.contentType | titlecase }} · {{ r.createdAt | date: 'MMM d, y, HH:mm' }}</span>
                </div>
              </div>
              <p class="body">{{ r.snippet || '(content unavailable)' }}</p>
            </div>
            <div class="meta">
              <div><span class="muted">Reported by</span><b>{{ r.reporterUsername ? '@' + r.reporterUsername : '—' }}</b></div>
              <div><span class="muted">Author status</span><b>{{ r.authorStatus | titlecase }}</b></div>
              <div><span class="muted">Assigned to</span><b>{{ assigneeLabel(r) }}</b></div>
              @if (r.details) { <div class="det">“{{ r.details }}”</div> }
            </div>
          </div>
        </div>

        <div>
          @if (auth.can('GRIEVANCES:EDIT')) {
          <div class="card" style="margin-bottom:20px">
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
              <button class="btn" (click)="resolve('DISMISS')" [disabled]="busy()"><lucide-icon name="check" [size]="15" /> Dismiss</button>
              <button class="btn" (click)="resolve('TAKEDOWN')" [disabled]="busy()"><lucide-icon name="flag" [size]="15" /> Take down content</button>
              <button class="btn" (click)="resolve('WARN')" [disabled]="busy()"><lucide-icon name="mail" [size]="15" /> Warn author</button>
              <button class="btn" (click)="resolve('SUSPEND')" [disabled]="busy()"><lucide-icon name="pause" [size]="15" /> Suspend author · 7d</button>
              <button class="btn danger" (click)="resolve('BAN')" [disabled]="busy()"><lucide-icon name="ban" [size]="15" /> Ban author</button>
            </div>
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
    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
    .preview { border: 1px solid var(--line); border-radius: 14px; padding: 18px; background: var(--surface-2); margin: 4px 0 16px; }
    .ph { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
    .av { width: 36px; height: 36px; border-radius: 10px; background: var(--av); display: grid; place-items: center; font-weight: 700; font-size: 12px; }
    .ph b { display: block; font-size: 14px; } .ph .muted { font-size: 12px; }
    .body { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin: 0; }
    .meta > div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line-soft); font-size: 12.5px; }
    .meta .det { display: block; font-style: italic; color: var(--muted-2); border: 0; border-left: 2px solid var(--brand-line); padding-left: 12px; }
    .acts { display: flex; flex-direction: column; gap: 9px; margin-top: 14px; }
    .acts .btn { display: flex; align-items: center; gap: 10px; text-align: left; }
  `,
})
export class ReportDetailComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly report = signal<ReportDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  reason = '';

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.report(id).subscribe({
      next: (r) => this.report.set(r),
      error: () => this.error.set('Could not load this report.'),
    });
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
    return r.assigneeAdminId === this.auth.me()?.id ? 'you' : '#' + r.assigneeAdminId;
  }

  resolve(action: ResolveAction): void {
    const r = this.report();
    if (!r) return;
    this.busy.set(true);
    this.api.resolve(r.id, { action, reason: this.reason || undefined }).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/moderation']);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Action failed — check the admin API / internal hook.');
      },
    });
  }

  statusClass(s: string): string {
    switch (s) {
      case 'PENDING': return 'pending';
      case 'REVIEWING': return 'review';
      case 'RESOLVED': return 'resolved';
      default: return 'dismissed';
    }
  }
}
