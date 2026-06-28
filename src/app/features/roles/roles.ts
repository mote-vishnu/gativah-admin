import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/icon';
import { CheckboxComponent, InputComponent } from '../../shared/forms';
import { DrawerComponent } from '../../shared/drawer';
import { PageHeaderComponent } from '../../shared/page-header';
import { TableColumn, TableComponent } from '../../shared/table';

import { RolesApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { FeaturePermissions, RoleResponse } from '../../core/models';

interface Editor {
  id: number | null;
  name: string;
  description: string;
  system: boolean;
  permissionIds: Set<number>;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, IconComponent, InputComponent, CheckboxComponent, TableComponent, DrawerComponent, PageHeaderComponent],
  template: `
    <ui-page-header icon="shield-check" title="Roles & Permissions" subtitle="Permission groups assigned to staff"
                    tint="violet" [count]="roles().length">
      @if (canAdd()) {
        <button page-actions class="btn primary" (click)="startCreate()"><lucide-icon name="plus" [size]="15" /> New role</button>
      }
    </ui-page-header>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    <ui-drawer [open]="!!editor()" [title]="editor()?.id ? 'Edit role' : 'New role'" [width]="520" (closed)="cancel()">
      @if (editor(); as e) {
        <ui-input label="Name" placeholder="e.g. Refunds Analyst" [disabled]="e.system"
                  [hint]="e.system ? 'Built-in role — name is fixed' : ''" [(ngModel)]="e.name" />
        <ui-input label="Description" placeholder="optional" [(ngModel)]="e.description" />

        <label class="field">Permissions</label>
        <ui-input class="psearch" placeholder="Search permissions…" [ngModel]="permQuery()" (ngModelChange)="permQuery.set($event)" />
        <div class="pcards">
          @for (f of filteredCatalog(); track f.featureCode) {
            <div class="pcard">
              <div class="pc-h">
                <div class="pc-feat"><b>{{ f.label }}</b><small>{{ f.featureCode }}</small></div>
                <ui-checkbox [checked]="allSelected(f, e)" (checkedChange)="toggleAll(f, $event)">{{ countSel(f, e) }}/{{ f.permissions.length }}</ui-checkbox>
              </div>
              <div class="pc-actions">
                @for (p of f.permissions; track p.id) {
                  <ui-checkbox [checked]="e.permissionIds.has(p.id)" (checkedChange)="togglePerm(p.id)">{{ p.action | titlecase }}</ui-checkbox>
                }
              </div>
            </div>
          } @empty {
            <div class="empty">No permissions match “{{ permQuery() }}”.</div>
          }
        </div>
      }
      <button drawer-footer class="btn" (click)="cancel()">Cancel</button>
      <button drawer-footer class="btn primary" (click)="save()" [disabled]="busy() || !editor()?.name?.trim()">
        {{ editor()?.id ? 'Save changes' : 'Create role' }}
      </button>
    </ui-drawer>

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
                @if (canEdit() && !isLocked(r)) {
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
    .psearch { display: block; margin: 8px 0 12px; }
    .pcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
    .pcard { border: 1px solid var(--line); border-radius: 12px; padding: 13px 14px; background: var(--surface-2); }
    .pc-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--line-soft); }
    .pc-feat b { font-size: 13px; } .pc-feat small { display: block; font-family: var(--mono); font-size: 9.5px; color: var(--muted-2); margin-top: 2px; }
    .pc-actions { display: flex; flex-direction: column; gap: 9px; }
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

  readonly roles = signal<RoleResponse[]>([]);
  readonly catalog = signal<FeaturePermissions[]>([]);
  readonly permQuery = signal('');
  readonly editor = signal<Editor | null>(null);

  readonly filteredCatalog = computed(() => {
    const q = this.permQuery().trim().toLowerCase();
    const cat = this.catalog();
    if (!q) { return cat; }
    return cat.filter((f) =>
      f.label.toLowerCase().includes(q)
      || f.featureCode.toLowerCase().includes(q)
      || f.permissions.some((p) => p.action.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)));
  });
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

  countSel(f: FeaturePermissions, e: Editor): number {
    return f.permissions.filter((p) => e.permissionIds.has(p.id)).length;
  }

  allSelected(f: FeaturePermissions, e: Editor): boolean {
    return f.permissions.length > 0 && f.permissions.every((p) => e.permissionIds.has(p.id));
  }

  toggleAll(f: FeaturePermissions, on: boolean): void {
    const e = this.editor();
    if (!e) { return; }
    const next = new Set(e.permissionIds);
    for (const p of f.permissions) {
      if (on) { next.add(p.id); } else { next.delete(p.id); }
    }
    this.editor.set({ ...e, permissionIds: next });
  }

  /** SUPER_ADMIN is the immutable safety net — never editable. */
  isLocked(r: RoleResponse): boolean {
    return r.name === 'SUPER_ADMIN';
  }

  startCreate(): void {
    this.permQuery.set('');
    this.editor.set({ id: null, name: '', description: '', system: false, permissionIds: new Set() });
  }

  startEdit(r: RoleResponse): void {
    this.permQuery.set('');
    this.editor.set({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      system: r.system,
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
      // System roles can't be renamed — omit name so the backend doesn't reject the edit.
      this.api.update(e.id, {
        name: e.system ? undefined : e.name.trim(),
        description: e.description.trim() || null,
        permissionIds,
      }).subscribe(done);
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
