import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectOption } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { TableColumn, TableComponent } from '../../shared/table';

import { RolesApi, StaffApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { Page, RoleResponse, StaffRow } from '../../core/models';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe, RouterLink, IconComponent, InputComponent, MultiSelectComponent, TableComponent, PageHeaderComponent],
  template: `
    <ui-page-header eyebrow="Platform" icon="user-plus" title="Staff" subtitle="Admin accounts & role assignment"
                    tint="orange" [count]="page()?.totalElements ?? null">
      @if (canAdd()) {
        <button page-actions class="btn primary" (click)="toggleInvite()"><lucide-icon name="user-plus" [size]="15" /> Invite admin</button>
      }
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (page()) {
      <div class="row g4" style="margin-bottom:18px">
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="users" [size]="16" /></span> Admins</div><div class="val c-orange">{{ adminCount() }}</div><div class="delta flat">{{ superCount() }} super-admin</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="shield-check" [size]="16" /></span> MFA enrolled</div><div class="val c-green">{{ mfaCount() }}<small> / {{ adminCount() }}</small></div><div class="delta flat">{{ mfaPct() }}% coverage</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="check" [size]="16" /></span> Active</div><div class="val c-cyan">{{ activeCount() }}</div><div class="delta flat">{{ disabledCount() }} disabled</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="shield-check" [size]="16" /></span> Roles</div><div class="val c-violet">{{ roles().length }}</div><div class="delta flat">defined</div></div>
      </div>
    }

    @if (showInvite()) {
      <div class="card invite">
        <div class="grid">
          <ui-input label="Email" type="email" [(ngModel)]="inv.email" />
          <ui-input label="Name" [(ngModel)]="inv.name" />
          <ui-input label="Temp password" type="password" hint="Minimum 10 characters" [(ngModel)]="inv.password" />
          <ui-multiselect label="Roles" placeholder="Assign roles…" [options]="roleOptions()" [(ngModel)]="inviteRoleIds" />
        </div>
        <div class="actions">
          <button class="btn" (click)="toggleInvite()">Cancel</button>
          <button class="btn primary" (click)="submitInvite()" [disabled]="busy() || inviteRoleIds().length === 0">Create</button>
        </div>
      </div>
    }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="(page()?.content?.length ?? 0) === 0" emptyText="No staff accounts.">
      @for (s of page()?.content ?? []; track s.id) {
            <tr class="clickable" [routerLink]="['/team/staff', s.id]">
              <td><div class="u"><span class="av">{{ initials(s.name) }}</span><div class="nm"><b>{{ s.name }}</b><span>{{ s.email }}</span></div></div></td>
              <td>
                <div class="chips">
                  @for (r of s.roles; track r) { <span class="chip">{{ r }}</span> }
                  @if (s.roles.length === 0) { <span class="muted">none</span> }
                </div>
              </td>
              <td><span class="pill" [class]="s.status === 'ACTIVE' ? 'active' : 'dismissed'">{{ s.status | titlecase }}</span></td>
              <td>@if (s.mfaEnrolled) { <span class="mfa-on">✓ enrolled</span> } @else { <span class="muted">—</span> }</td>
              <td class="muted">{{ s.lastLoginAt ? (s.lastLoginAt | date: 'MMM d, HH:mm') : 'never' }}</td>
              <td class="rowact"><span class="manage">Manage <lucide-icon name="chevron-right" [size]="13" /></span></td>
            </tr>
      }
    </ui-table>
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .btn.tiny { padding: 5px 10px; font-size: 11px; }
    .invite { margin-bottom: 18px; }
    .invite .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
    .u { display: flex; align-items: center; gap: 10px; }
    .av { width: 30px; height: 30px; border-radius: 9px; background: var(--av); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .nm b { font-size: 13px; } .nm span { display: block; font-size: 11px; color: var(--muted-2); }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .chip { font-family: var(--mono); font-size: 10px; padding: 3px 8px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); }
    .mfa-on { color: var(--green); font-size: 12px; font-weight: 600; }
    .kpi .val small { font-size: 14px; color: var(--muted-2); font-weight: 600; }
    .clickable { cursor: pointer; }
    .clickable:hover .nm b { color: var(--brand); }
    .rowact { text-align: right; }
    .manage { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 600; color: var(--muted-2); }
    .clickable:hover .manage { color: var(--brand); }
  `,
})
export class StaffComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly auth = inject(AuthService);

  readonly page = signal<Page<StaffRow> | null>(null);
  readonly roles = signal<RoleResponse[]>([]);
  readonly loading = signal(true);
  readonly showInvite = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { label: 'Member' }, { label: 'Roles' }, { label: 'Status' }, { label: 'MFA' }, { label: 'Last login' }, { label: '', align: 'right' },
  ];

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map((r) => ({ value: String(r.id), label: r.name })),
  );

  readonly canAdd = computed(() => this.auth.can('STAFF:ADD'));

  private readonly rows = computed(() => this.page()?.content ?? []);
  readonly adminCount = computed(() => this.rows().length);
  readonly mfaCount = computed(() => this.rows().filter((s) => s.mfaEnrolled).length);
  readonly mfaPct = computed(() => { const n = this.adminCount(); return n ? Math.round((this.mfaCount() / n) * 100) : 0; });
  readonly activeCount = computed(() => this.rows().filter((s) => s.status === 'ACTIVE').length);
  readonly disabledCount = computed(() => this.adminCount() - this.activeCount());
  readonly superCount = computed(() => this.rows().filter((s) => s.roles.includes('SUPER_ADMIN')).length);

  // Selected role ids as strings (ui-multiselect value type), mapped to numbers on submit.
  readonly inviteRoleIds = signal<string[]>([]);

  inv: { email: string; name: string; password: string } = { email: '', name: '', password: '' };

  ngOnInit(): void {
    this.load();
    this.rolesApi.list().subscribe({ next: (r) => this.roles.set(r.roles), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(0, 50).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: () => { this.error.set('Could not load staff (needs STAFF:VIEW).'); this.loading.set(false); },
    });
  }

  toggleInvite(): void { this.showInvite.update((v) => !v); }

  submitInvite(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.invite({ ...this.inv, roleIds: this.inviteRoleIds().map(Number) }).subscribe({
      next: () => {
        this.busy.set(false);
        this.showInvite.set(false);
        this.inv = { email: '', name: '', password: '' };
        this.inviteRoleIds.set([]);
        this.load();
      },
      error: () => { this.busy.set(false); this.error.set('Invite failed (duplicate email or weak password?).'); },
    });
  }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
