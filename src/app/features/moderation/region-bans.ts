import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PageHeaderComponent } from '../../shared/page-header';
import { TableColumn, TableComponent } from '../../shared/table';
import { ModerationApi } from '../../core/moderation.api';
import { AuthService } from '../../core/auth.service';
import { AdminDirectoryService } from '../../core/admin-directory.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RegionBanRow } from '../../core/models';

@Component({
  selector: 'app-region-bans',
  standalone: true,
  imports: [DatePipe, TableComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="globe" title="Region bans" subtitle="Geo-restrictions on posts" tint="violet"
                    [count]="activeCount()" />

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-table [columns]="columns()" [loading]="loading()" [empty]="rows().length === 0" emptyText="No region bans.">
      @for (b of rows(); track b.id) {
        <tr [class.lifted]="b.lifted">
          <td><b>Post #{{ b.postId }}</b> · {{ snippet(b) }}</td>
          <td>{{ b.authorUsername ? '@' + b.authorUsername : '—' }}</td>
          <td><span class="pill reason">{{ b.country }}</span></td>
          <td class="muted">{{ b.reason || '—' }}</td>
          <td>{{ dir.name(b.bannedByAdminId) }}</td>
          <td class="muted">{{ b.bannedAt | date: 'MMM d, y, HH:mm' }}</td>
          <td>
            @if (b.lifted) { <span class="pill dismissed">lifted</span> }
            @else { <span class="pill active">active</span> }
          </td>
          @if (canEdit()) {
            <td class="rowact">
              @if (!b.lifted) {
                <button class="link" (click)="lift(b)" [disabled]="busy()">Lift</button>
              } @else { <span class="muted">—</span> }
            </td>
          }
        </tr>
      }
    </ui-table>
  `,
  styles: `
    tr.lifted { opacity: 0.55; }
    .rowact { text-align: right; white-space: nowrap; }
    .link { background: none; border: none; color: var(--brand); cursor: pointer; font-size: 12px; }
    .link:hover { text-decoration: underline; }
  `,
})
export class RegionBansComponent implements OnInit {
  private readonly api = inject(ModerationApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly dir = inject(AdminDirectoryService);

  readonly rows = signal<RegionBanRow[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.can('GRIEVANCES:EDIT'));
  readonly activeCount = computed(() => this.rows().filter((b) => !b.lifted).length);
  readonly columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [
      { label: 'Content' }, { label: 'Author' }, { label: 'Region' }, { label: 'Reason' }, { label: 'By' }, { label: 'When' }, { label: 'Status' },
    ];
    return this.canEdit() ? [...cols, { label: '', align: 'right' }] : cols;
  });

  ngOnInit(): void {
    this.dir.load();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.regionBans().subscribe({
      next: (r) => { this.rows.set(r.items); this.loading.set(false); },
      error: () => { this.error.set('Could not load region bans (needs GRIEVANCES:VIEW).'); this.loading.set(false); },
    });
  }

  snippet(b: RegionBanRow): string {
    return b.snippet ? b.snippet.slice(0, 60) : '(no preview)';
  }

  async lift(b: RegionBanRow): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Lift region ban in ${b.country}?`,
      message: `Post #${b.postId} becomes visible again in ${b.country}.`,
      confirmLabel: 'Lift ban',
    });
    if (!res.confirmed) { return; }
    this.busy.set(true);
    this.api.liftRegionBan(b.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Region ban lifted.'); this.load(); },
      error: () => { this.busy.set(false); this.toast.error('Could not lift the region ban.'); },
    });
  }
}
