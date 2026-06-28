import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ModerationApi } from '../../core/moderation.api';
import { Page, ReportSummary } from '../../core/models';

const STATUSES = ['ALL', 'PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'];

@Component({
  selector: 'app-moderation-list',
  standalone: true,
  template: `
    <h1 class="title">Grievances</h1>
    <p class="crumb">Content reports &amp; moderation</p>

    <div class="filters">
      @for (s of statuses; track s) {
        <span class="chip" [class.on]="status() === s" (click)="setStatus(s)">{{ s | titlecase }}</span>
      }
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <div class="card" style="padding:6px">
      <table>
        <thead>
          <tr><th>Reported content</th><th>Author</th><th>Reporter</th><th>Reason</th><th>Status</th><th>When</th></tr>
        </thead>
        <tbody>
          @for (r of page()?.content ?? []; track r.id) {
            <tr class="clickable" (click)="open(r)">
              <td><b>{{ r.contentType | titlecase }}</b> · {{ snippet(r) }}</td>
              <td>{{ r.authorUsername ? '@' + r.authorUsername : '—' }}</td>
              <td>{{ r.reporterUsername ? '@' + r.reporterUsername : '—' }}</td>
              <td><span class="pill reason">{{ r.reason }}</span></td>
              <td><span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span></td>
              <td class="muted">{{ r.createdAt | date: 'MMM d, HH:mm' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6"><div class="empty">No reports.</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span>{{ total() }} report(s)</span>
      <div class="pg">
        <button (click)="prev()" [disabled]="pageIndex() === 0">‹</button>
        <button disabled>{{ pageIndex() + 1 }}</button>
        <button (click)="next()" [disabled]="(page()?.totalPages ?? 1) <= pageIndex() + 1">›</button>
      </div>
    </div>
  `,
  styles: `
    .title { font-family: var(--disp); font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0 0 18px; }
  `,
  imports: [DatePipe, TitleCasePipe],
})
export class ModerationListComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly router = inject(Router);

  readonly statuses = STATUSES;
  readonly status = signal('PENDING');
  readonly pageIndex = signal(0);
  readonly page = signal<Page<ReportSummary> | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const status = this.status() === 'ALL' ? null : this.status();
    this.api.reports({ status, page: this.pageIndex(), size: 20 }).subscribe({
      next: (p) => this.page.set(p),
      error: () => this.error.set('Could not load reports.'),
    });
  }

  setStatus(s: string): void {
    this.status.set(s);
    this.pageIndex.set(0);
    this.load();
  }

  next(): void { this.pageIndex.update((i) => i + 1); this.load(); }
  prev(): void { this.pageIndex.update((i) => Math.max(0, i - 1)); this.load(); }

  total(): number { return this.page()?.totalElements ?? 0; }

  open(r: ReportSummary): void {
    void this.router.navigate(['/moderation', r.id]);
  }

  snippet(r: ReportSummary): string {
    return r.snippet ? r.snippet.slice(0, 60) : '(no preview)';
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
