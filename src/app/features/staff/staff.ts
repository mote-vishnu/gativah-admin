import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectComponent, SelectOption } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';

import { RolesApi, StaffApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { Page, RoleResponse, StaffRow } from '../../core/models';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISABLED', label: 'Disabled' },
];

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, InputComponent, SelectComponent, MultiSelectComponent, TableComponent],
  template: `
    <div class="head">
      <div>
        <h1 class="title">Staff</h1>
        <p class="crumb">Admin accounts &amp; role assignment</p>
      </div>
      @if (canAdd()) {
        <button class="btn primary" (click)="toggleInvite()"><lucide-icon name="user-plus" [size]="15" /> Invite admin</button>
      }
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

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
            <tr>
              <td><div class="u"><span class="av">{{ initials(s.name) }}</span><div class="nm"><b>{{ s.name }}</b><span>{{ s.email }}</span></div></div></td>
              <td>
                @if (editingId() === s.id) {
                  <div class="roles-edit">
                    <ui-multiselect size="sm" placeholder="Assign roles…" [options]="roleOptions()" [(ngModel)]="editRoleIds" />
                    <div class="roles-actions">
                      <button class="btn tiny" (click)="cancelRoles()">Cancel</button>
                      <button class="btn tiny primary" (click)="saveRoles(s)" [disabled]="busy()">Save</button>
                    </div>
                  </div>
                } @else {
                  <div class="chips">
                    @for (r of s.roles; track r) { <span class="chip">{{ r }}</span> }
                    @if (s.roles.length === 0) { <span class="muted">none</span> }
                    @if (canEdit()) {
                      <button class="link" (click)="openRoles(s)" title="Edit roles"><lucide-icon name="pencil" [size]="12" /></button>
                    }
                  </div>
                }
              </td>
              <td>
                @if (canEdit()) {
                  <ui-select size="sm" [options]="statusOptions" [ngModel]="s.status" (ngModelChange)="changeStatus(s, $event)" />
                } @else { {{ s.status }} }
              </td>
              <td>{{ s.mfaEnrolled ? '✓' : '—' }}</td>
              <td class="muted">{{ s.lastLoginAt ? (s.lastLoginAt | date: 'MMM d, HH:mm') : 'never' }}</td>
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
    .link { background: none; border: none; color: var(--brand); cursor: pointer; display: inline-flex; padding: 2px; }
    .roles-edit { display: flex; flex-direction: column; gap: 10px; min-width: 260px; }
    .roles-actions { display: flex; gap: 8px; justify-content: flex-end; }
  `,
})
export class StaffComponent implements OnInit {
  private readonly api = inject(StaffApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly auth = inject(AuthService);

  readonly statusOptions = STATUS_OPTIONS;

  readonly page = signal<Page<StaffRow> | null>(null);
  readonly roles = signal<RoleResponse[]>([]);
  readonly loading = signal(true);
  readonly showInvite = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { label: 'Member' }, { label: 'Roles' }, { label: 'Status' }, { label: 'MFA' }, { label: 'Last login' },
  ];

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map((r) => ({ value: String(r.id), label: r.name })),
  );

  readonly canAdd = computed(() => this.auth.can('STAFF:ADD'));
  readonly canEdit = computed(() => this.auth.can('STAFF:EDIT'));

  // Selected role ids as strings (ui-multiselect value type), mapped to numbers on submit.
  readonly inviteRoleIds = signal<string[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly editRoleIds = signal<string[]>([]);

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

  openRoles(s: StaffRow): void {
    const ids = this.roles().filter((r) => s.roles.includes(r.name)).map((r) => String(r.id));
    this.editRoleIds.set(ids);
    this.editingId.set(s.id);
  }

  cancelRoles(): void { this.editingId.set(null); }

  saveRoles(s: StaffRow): void {
    this.busy.set(true);
    this.api.setRoles(s.id, { roleIds: this.editRoleIds().map(Number) }).subscribe({
      next: () => { this.busy.set(false); this.editingId.set(null); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Could not update roles.'); },
    });
  }

  changeStatus(s: StaffRow, status: string): void {
    this.api.update(s.id, { status }).subscribe({ next: () => this.load(), error: () => this.error.set('Update failed.') });
  }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
