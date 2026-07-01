import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TableColumn, TableComponent } from '../../shared/table';
import { SanctionRow, UserReportRow } from '../../core/models';

/** Profile Reports & sanctions tab: reports filed against the user + sanction history. */
@Component({
  selector: 'app-user-reports-tab',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, RouterLink, TableComponent],
  template: `
    <div class="cols">
      <div class="card">
        <div class="card-h"><h3>Reports against this user</h3><span class="hint">{{ openCount() }} open · {{ reports().length }} shown</span></div>
        <ui-table [columns]="reportCols" [flush]="true" [empty]="reports().length === 0" emptyText="No reports filed against this user.">
          @for (r of reports(); track r.reportId) {
            <tr class="clickable" [routerLink]="['/moderation', r.reportId]">
              <td><b>{{ r.contentType | titlecase }}</b> <span class="muted snip">{{ plain(r.snippet) }}</span></td>
              <td><span class="pill reason">{{ r.reason | titlecase }}</span></td>
              <td><span class="pill" [class]="statusClass(r.status)">{{ r.status | titlecase }}</span></td>
            </tr>
          }
        </ui-table>
      </div>

      <div class="card">
        <div class="card-h"><h3>Sanction history</h3><span class="hint">{{ sanctions().length }} record(s)</span></div>
        @if (sanctions().length) {
          <div class="timeline">
            @for (s of sanctions(); track s.id) {
              <div class="tl">
                <div class="when">{{ s.createdAt | date: 'MMM d, y' }} · #{{ s.adminUserId }}</div>
                <div class="what">
                  <span class="pill" [class]="sanctionClass(s.type)">{{ s.type | titlecase }}</span>
                  <span class="muted">{{ s.reason || '—' }}</span>
                  @if (s.suspendedUntil) { <span class="muted">· until {{ s.suspendedUntil | date: 'MMM d, y' }}</span> }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty">No sanctions on record.</div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; align-items: start; }
    @media (max-width: 1000px) { .cols { grid-template-columns: 1fr; } }
    .snip { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
    .timeline { display: flex; flex-direction: column; gap: 4px; }
    .tl { padding: 10px 0 10px 16px; border-left: 2px solid var(--line); position: relative; }
    .tl::before { content: ''; position: absolute; left: -5px; top: 14px; width: 8px; height: 8px; border-radius: 50%; background: var(--brand); }
    .tl .when { font-family: var(--mono); font-size: 10.5px; color: var(--muted-2); }
    .tl .what { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; font-size: 12.5px; }
    .empty { padding: 40px; text-align: center; color: var(--muted-2); font-size: 13px; }
  `,
})
export class UserReportsTabComponent {
  readonly reports = input<UserReportRow[]>([]);
  readonly sanctions = input<SanctionRow[]>([]);

  readonly reportCols: TableColumn[] = [{ label: 'Content' }, { label: 'Reason' }, { label: 'Status' }];

  openCount(): number {
    return this.reports().filter((r) => r.status === 'PENDING' || r.status === 'REVIEWING').length;
  }

  plain(text: string | null): string {
    return (text || '').replace(/\{@\}\[([^\]]+)\]\((\d+)\)/g, '@$1');
  }

  statusClass(s: string): string {
    switch (s) {
      case 'PENDING': return 'pending';
      case 'REVIEWING': return 'review';
      case 'RESOLVED': return 'resolved';
      default: return 'dismissed';
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
}
