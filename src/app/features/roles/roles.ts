import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon';
import { CheckboxComponent, InputComponent } from '../../shared/forms';
import { TableColumn, TableComponent } from '../../shared/table';

import { RolesApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { FeaturePermissions, RoleResponse } from '../../core/models';

interface Editor {
  id: number | null;
  name: string;
  description: string;
  permissionIds: Set<number>;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [FormsModule, IconComponent, InputComponent, CheckboxComponent, TableComponent],
  template: `
    <div class="head">
      <div>
        <h1 class="title">Roles &amp; Permissions</h1>
        <p class="crumb">Permission groups assigned to staff</p>
      </div>
      @if (canAdd()) {
        <button class="btn primary" (click)="startCreate()"><lucide-icon name="plus" [size]="15" /> New role</button>
      }
    </div>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (editor(); as e) {
      <div class="card editor">
        <div class="card-h"><h3>{{ e.id ? 'Edit role' : 'New role' }}</h3></div>
        <div class="grid">
          <ui-input label="Name" placeholder="e.g. Refunds Analyst" [(ngModel)]="e.name" />
          <ui-input label="Description" placeholder="optional" [(ngModel)]="e.description" />
        </div>

        <label class="field">Permissions</label>
        <div class="matrix">
          <div class="mrow mhead">
            <span class="feat">Feature</span>
            @for (a of actions; track a) { <span class="act">{{ a }}</span> }
          </div>
          @for (f of catalog(); track f.featureCode) {
            <div class="mrow">
              <span class="feat"><b>{{ f.label }}</b><small>{{ f.featureCode }}</small></span>
              @for (a of actions; track a) {
                @let perm = permFor(f, a);
                <span class="act">
                  @if (perm) {
                    <ui-checkbox [checked]="e.permissionIds.has(perm.id)" (checkedChange)="togglePerm(perm.id)" />
                  } @else { <span class="dash">—</span> }
                </span>
              }
            </div>
          }
        </div>

        <div class="actions">
          <button class="btn" (click)="cancel()">Cancel</button>
          <button class="btn primary" (click)="save()" [disabled]="busy() || !e.name.trim()">{{ e.id ? 'Save changes' : 'Create role' }}</button>
        </div>
      </div>
    }

    <ui-table [columns]="columns" [loading]="loading()" [empty]="roles().length === 0" emptyText="No roles defined.">
      @for (r of roles(); track r.id) {
            <tr>
              <td>
                <div class="rn">
                  <b>{{ r.name }}</b>
                  @if (r.system) { <span class="sys">system</span> }
                </div>
                @if (r.description) { <span class="desc">{{ r.description }}</span> }
              </td>
              <td><span class="count">{{ r.permissions.length }}</span> permission(s)</td>
              <td><span class="count">{{ r.userCount }}</span> member(s)</td>
              <td class="rowact">
                @if (canEdit() && !r.system) {
                  <button class="link" (click)="startEdit(r)" title="Edit"><lucide-icon name="pencil" [size]="14" /></button>
                }
                @if (canDelete() && !r.system) {
                  <button class="link danger" (click)="remove(r)" title="Delete"><lucide-icon name="trash-2" [size]="14" /></button>
                }
              </td>
            </tr>
      }
    </ui-table>
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12px; margin: 0; }
    .btn { display: inline-flex; align-items: center; gap: 8px; }
    .editor { margin-bottom: 18px; }
    .editor .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 6px; }
    .matrix { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin: 8px 0 4px; }
    .mrow { display: grid; grid-template-columns: 2fr repeat(4, 1fr); align-items: center; padding: 9px 14px; border-top: 1px solid var(--line-soft); }
    .mrow.mhead { background: var(--surface-2); border-top: none; font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-2); }
    .feat { display: flex; flex-direction: column; gap: 2px; }
    .feat small { font-family: var(--mono); font-size: 9.5px; color: var(--muted-2); }
    .act { text-align: center; }
    .dash { color: var(--muted-2); }
    .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }
    .rn { display: flex; align-items: center; gap: 8px; }
    .rn b { font-size: 13.5px; }
    .sys { font-family: var(--mono); font-size: 9px; padding: 2px 7px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted-2); }
    .desc { display: block; font-size: 11.5px; color: var(--muted-2); margin-top: 3px; }
    .count { font-weight: 700; }
    .rowact { text-align: right; white-space: nowrap; }
    .link { background: none; border: none; color: var(--muted); cursor: pointer; padding: 5px; }
    .link:hover { color: var(--ink); }
    .link.danger:hover { color: #ef4444; }
  `,
})
export class RolesComponent implements OnInit {
  private readonly api = inject(RolesApi);
  private readonly auth = inject(AuthService);

  readonly actions = ['VIEW', 'ADD', 'EDIT', 'DELETE'];

  readonly roles = signal<RoleResponse[]>([]);
  readonly catalog = signal<FeaturePermissions[]>([]);
  readonly editor = signal<Editor | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly columns: TableColumn[] = [
    { label: 'Role' }, { label: 'Permissions' }, { label: 'Members' }, { label: '', align: 'right' },
  ];

  readonly canAdd = computed(() => this.auth.can('ROLES:ADD'));
  readonly canEdit = computed(() => this.auth.can('ROLES:EDIT'));
  readonly canDelete = computed(() => this.auth.can('ROLES:DELETE'));

  ngOnInit(): void {
    this.load();
    this.api.catalog().subscribe({ next: (c) => this.catalog.set(c.features), error: () => {} });
  }

  private load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (r) => { this.roles.set(r.roles); this.loading.set(false); },
      error: () => { this.error.set('Could not load roles (needs ROLES:VIEW).'); this.loading.set(false); },
    });
  }

  permFor(f: FeaturePermissions, action: string) {
    return f.permissions.find((p) => p.action === action) ?? null;
  }

  startCreate(): void {
    this.editor.set({ id: null, name: '', description: '', permissionIds: new Set() });
  }

  startEdit(r: RoleResponse): void {
    this.editor.set({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      permissionIds: new Set(r.permissionIds),
    });
  }

  togglePerm(id: number): void {
    const e = this.editor();
    if (!e) { return; }
    const next = new Set(e.permissionIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    this.editor.set({ ...e, permissionIds: next });
  }

  cancel(): void { this.editor.set(null); }

  save(): void {
    const e = this.editor();
    if (!e) { return; }
    this.busy.set(true);
    this.error.set(null);
    const permissionIds = [...e.permissionIds];
    const done = {
      next: () => { this.busy.set(false); this.editor.set(null); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Save failed (duplicate name?).'); },
    };
    if (e.id) {
      this.api.update(e.id, { name: e.name.trim(), description: e.description.trim() || null, permissionIds }).subscribe(done);
    } else {
      this.api.create({ name: e.name.trim(), description: e.description.trim() || null, permissionIds }).subscribe(done);
    }
  }

  remove(r: RoleResponse): void {
    if (!confirm(`Delete role "${r.name}"? This cannot be undone.`)) { return; }
    this.api.remove(r.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Delete failed (role may be system or still assigned).'),
    });
  }
}
