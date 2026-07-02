import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon';
import { InputComponent } from '../../shared/forms';
import { RolesApi, StaffApi } from '../../core/admin.api';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import { FeaturePermissions, RoleResponse, StaffRow } from '../../core/models';

interface FeatureRow {
  featureCode: string;
  label: string;
  icon: string;
  tint: string;
  granted: number;
  total: number;
  actions: { action: string; granted: boolean; id: number }[];
}

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, RouterLink, IconComponent, InputComponent],
  template: `
    <a routerLink="/team/roles" class="back">‹ Back to roles</a>

    @if (error()) { <div class="note">⚠ {{ error() }}</div> }

    @if (role(); as r) {
      <div class="head">
        <div class="hl">
          <span class="hic" [class]="featureTint(primaryFeature())"><lucide-icon name="shield-check" [size]="22" /></span>
          @if (editing()) {
            <div class="hedit">
              <ui-input class="ni" [(ngModel)]="editName" [disabled]="r.system"
                        [hint]="r.system ? 'Built-in role — name is fixed' : ''" placeholder="Role name" />
              <ui-input class="di" [(ngModel)]="editDesc" placeholder="Description (optional)" />
            </div>
          } @else {
            <div>
              <h1 class="title">{{ r.name }} @if (r.system) { <span class="sys">system</span> }</h1>
              <p class="crumb">{{ r.description || 'No description' }}</p>
            </div>
          }
        </div>
        <div class="acts">
          @if (editing()) {
            <button class="btn" (click)="cancelEdit()" [disabled]="busy()">Cancel</button>
            <button class="btn primary" (click)="saveEdit(r)" [disabled]="busy() || !editName.trim()"><lucide-icon name="check" [size]="15" /> Save changes</button>
          } @else {
            @if (canAdd()) { <button class="btn" (click)="clone(r)"><lucide-icon name="plus-circle" [size]="15" /> Duplicate</button> }
            @if (canEdit() && !isLocked(r)) { <button class="btn primary" (click)="startEdit(r)"><lucide-icon name="pencil" [size]="15" /> Edit</button> }
            @if (canDelete() && !r.system) { <button class="btn danger" (click)="remove(r)"><lucide-icon name="trash-2" [size]="15" /> Delete</button> }
          }
        </div>
      </div>

      <div class="row g3">
        <div class="card kpi"><div class="lab"><span class="ic tint-violet"><lucide-icon name="shield-check" [size]="16" /></span> Permissions</div><div class="val c-violet">{{ grantedTotal() }}<small> / {{ totalPerms() }}</small></div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-cyan"><lucide-icon name="users" [size]="16" /></span> Members</div><div class="val c-cyan">{{ r.userCount }}</div></div>
        <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="layout-dashboard" [size]="16" /></span> Features</div><div class="val c-orange">{{ activeFeatureCount() }}<small> / {{ matrix().length }}</small></div></div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-h">
          <h3>Capabilities</h3>
          <span class="hint">{{ editing() ? 'click actions to grant or revoke' : 'what this role can do, by feature' }}</span>
        </div>
        <div class="acards">
          @for (f of matrix(); track f.featureCode) {
            <div class="acard" [class.off]="!editing() && f.granted === 0">
              <div class="ac-h">
                <span class="ac-ic"><lucide-icon [name]="f.icon" [size]="15" /></span>
                <span class="ac-t"><b>{{ f.label }}</b><small>{{ f.granted }} / {{ f.total }} actions</small></span>
                @if (editing()) {
                  <button class="ac-all" (click)="toggleFeature(f)">{{ f.granted === f.total ? 'clear' : 'all' }}</button>
                }
              </div>
              <div class="ac-actions">
                @for (a of f.actions; track a.id) {
                  <button type="button" class="apill" [class]="a.granted ? actionTint(a.action) : 'no'"
                          [class.editable]="editing()" [disabled]="!editing()" (click)="togglePerm(a.id)">
                    <i class="dot"></i>{{ a.action | titlecase }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-h"><h3>Members</h3><span class="hint">staff holding this role</span></div>
        @if (members().length) {
          <div class="mem">
            @for (m of members(); track m.id) {
              <a class="mitem" [routerLink]="['/team/staff']">
                <span class="av">{{ initials(m) }}</span>
                <div class="mi"><b>{{ m.name }}</b><span>{{ m.email }}</span></div>
                <span class="pill" [class]="m.status === 'ACTIVE' ? 'active' : 'dismissed'">{{ m.status | titlecase }}</span>
              </a>
            }
          </div>
        } @else {
          <div class="empty">No staff currently hold this role.</div>
        }
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .back:hover { color: var(--ink); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .hl { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
    .hedit { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; max-width: 480px; }
    .hic { width: 46px; height: 46px; flex: 0 0 auto; border-radius: 13px; display: grid; place-items: center; box-shadow: var(--shadow-sm); }
    .title { font-family: var(--sans); font-weight: 800; font-size: 22px; margin: 0 0 3px; letter-spacing: -0.02em; }
    .crumb { color: var(--muted-2); font-size: 12.5px; margin: 0; }
    .sys { font-family: var(--mono); font-size: 9px; padding: 2px 7px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted-2); vertical-align: 3px; }
    .acts { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; gap: 7px; }
    .btn.danger { color: var(--rose); } .btn.danger:hover { border-color: var(--rose); }
    .kpi .val small { font-size: 15px; color: var(--muted-2); font-weight: 600; }

    .acards { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 12px; }
    .acard { border: 1px solid var(--line); border-radius: 13px; padding: 13px 14px; background: var(--surface-2); transition: 0.15s var(--ease); }
    .acard:hover { border-color: var(--line-strong); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
    .acard.off { opacity: 0.55; }
    .ac-h { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .ac-ic { width: 30px; height: 30px; flex: 0 0 auto; border-radius: 9px; display: grid; place-items: center; color: var(--muted); background: var(--surface-3); }
    .ac-t { min-width: 0; flex: 1; } .ac-t b { display: block; font-size: 13px; letter-spacing: -0.01em; }
    .ac-t small { font-size: 10px; color: var(--muted-2); }
    .ac-all { flex: 0 0 auto; background: none; border: 1px solid var(--line); border-radius: 999px; font: inherit; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); padding: 2px 9px; cursor: pointer; transition: 0.12s var(--ease); }
    .ac-all:hover { color: var(--brand); border-color: var(--brand-line); }
    .ac-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .apill { display: inline-flex; align-items: center; gap: 5px; font-family: inherit; font-size: 10.5px; font-weight: 600; padding: 3px 9px 3px 8px; border-radius: 999px; color: var(--muted); background: color-mix(in srgb, currentColor 11%, transparent); border: 1px solid color-mix(in srgb, currentColor 22%, transparent); cursor: default; transition: 0.12s var(--ease); }
    .apill:disabled { opacity: 1; }
    .apill.editable { cursor: pointer; }
    .apill.editable:hover { background: color-mix(in srgb, currentColor 20%, transparent); border-color: color-mix(in srgb, currentColor 40%, transparent); }
    .apill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .apill.view { color: var(--cyan); } .apill.add { color: var(--green); } .apill.edit { color: var(--amber); } .apill.del { color: var(--rose); }
    .apill.no { color: var(--muted-2); background: transparent; border-style: dashed; opacity: 0.6; }
    .apill.no.editable:hover { opacity: 1; background: color-mix(in srgb, currentColor 14%, transparent); }
    .apill.no .dot { opacity: 0.35; }

    .mem { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .mitem { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); text-decoration: none; color: inherit; }
    .mitem:hover { border-color: var(--line-strong); }
    .av { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 9px; background: var(--av); display: grid; place-items: center; font-weight: 700; font-size: 11px; }
    .mi { min-width: 0; flex: 1; } .mi b { display: block; font-size: 13px; } .mi span { display: block; font-size: 11px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class RoleDetailComponent implements OnInit {
  private readonly api = inject(RolesApi);
  private readonly staffApi = inject(StaffApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly role = signal<RoleResponse | null>(null);
  readonly catalog = signal<FeaturePermissions[]>([]);
  readonly members = signal<StaffRow[]>([]);
  readonly error = signal<string | null>(null);

  // inline edit state
  readonly editing = signal(false);
  readonly editPerms = signal<Set<number>>(new Set());
  readonly busy = signal(false);
  editName = '';
  editDesc = '';

  readonly canAdd = computed(() => this.auth.can('ROLES:ADD'));
  readonly canEdit = computed(() => this.auth.can('ROLES:EDIT'));
  readonly canDelete = computed(() => this.auth.can('ROLES:DELETE'));
  readonly totalPerms = computed(() => this.catalog().reduce((n, f) => n + f.permissions.length, 0));

  readonly matrix = computed<FeatureRow[]>(() => {
    const editing = this.editing();
    const grantedCodes = new Set(this.role()?.permissions ?? []);
    const editSet = this.editPerms();
    return this.catalog().map((f) => {
      const actions = f.permissions.map((p) => ({
        action: p.action,
        id: p.id,
        granted: editing ? editSet.has(p.id) : grantedCodes.has(p.code),
      }));
      return {
        featureCode: f.featureCode,
        label: f.label,
        icon: this.featureIcon(f.featureCode),
        tint: this.featureTint(f.featureCode),
        granted: actions.filter((a) => a.granted).length,
        total: actions.length,
        actions,
      };
    });
  });
  readonly grantedTotal = computed(() => this.matrix().reduce((n, f) => n + f.granted, 0));
  readonly activeFeatureCount = computed(() => this.matrix().filter((f) => f.granted > 0).length);
  readonly primaryFeature = computed(() => this.matrix().find((f) => f.granted > 0)?.featureCode ?? '');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.catalog().subscribe({ next: (c) => this.catalog.set(c.features), error: () => {} });
    this.api.list().subscribe({
      next: (r) => {
        const found = r.roles.find((x) => x.id === id) ?? null;
        this.role.set(found);
        if (!found) { this.error.set('Role not found.'); return; }
        this.staffApi.list(0, 200).subscribe({
          next: (p) => this.members.set(p.content.filter((s) => s.roles.includes(found.name))),
          error: () => {},
        });
      },
      error: () => this.error.set('Could not load this role (needs ROLES:VIEW).'),
    });
  }

  isLocked(r: RoleResponse): boolean { return r.name === 'SUPER_ADMIN'; }

  startEdit(r: RoleResponse): void {
    this.editName = r.name;
    this.editDesc = r.description ?? '';
    this.editPerms.set(new Set(r.permissionIds));
    this.editing.set(true);
  }

  cancelEdit(): void { this.editing.set(false); }

  togglePerm(id: number): void {
    if (!this.editing()) { return; }
    const next = new Set(this.editPerms());
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    this.editPerms.set(next);
  }

  /** Grant all of a feature's actions, or clear them all if already fully granted. */
  toggleFeature(f: FeatureRow): void {
    const next = new Set(this.editPerms());
    const grantAll = f.granted < f.total;
    for (const a of f.actions) {
      if (grantAll) { next.add(a.id); } else { next.delete(a.id); }
    }
    this.editPerms.set(next);
  }

  saveEdit(r: RoleResponse): void {
    this.busy.set(true);
    this.api.update(r.id, {
      name: r.system ? undefined : this.editName.trim(),
      description: this.editDesc.trim() || null,
      permissionIds: [...this.editPerms()],
    }).subscribe({
      next: (updated) => { this.busy.set(false); this.editing.set(false); this.role.set(updated); this.toast.success('Role updated.'); },
      error: () => { this.busy.set(false); this.toast.error('Save failed (duplicate name?).'); },
    });
  }

  clone(r: RoleResponse): void {
    void this.router.navigate(['/team/roles'], { queryParams: { clone: r.id } });
  }

  async remove(r: RoleResponse): Promise<void> {
    const res = await this.confirm.confirm({
      title: `Delete role "${r.name}"?`,
      message: 'This cannot be undone. Roles that are system or still assigned cannot be deleted.',
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (!res.confirmed) { return; }
    this.api.remove(r.id).subscribe({
      next: () => { this.toast.success(`Role "${r.name}" deleted.`); void this.router.navigate(['/team/roles']); },
      error: () => this.toast.error('Delete failed (role may be system or still assigned).'),
    });
  }

  initials(m: StaffRow): string {
    return (m.name || m.email || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  actionTint(action: string): string {
    switch (action.toUpperCase()) {
      case 'ADD': return 'add';
      case 'EDIT': return 'edit';
      case 'DELETE': return 'del';
      default: return 'view';
    }
  }

  featureIcon(code: string): string {
    switch (code) {
      case 'DASHBOARD': return 'layout-dashboard';
      case 'GRIEVANCES': return 'flag';
      case 'APPEALS': case 'LEGAL': return 'scale';
      case 'FINANCE': return 'dollar-sign';
      case 'BILLING': return 'credit-card';
      case 'STAFF': case 'USERS': return 'users';
      case 'ROLES': return 'shield-check';
      case 'AUDIT': return 'scroll-text';
      case 'CONTENT': return 'message-square';
      case 'CLUBS': return 'users-round';
      default: return 'shield-check';
    }
  }

  featureTint(code: string): string {
    switch (code) {
      case 'DASHBOARD': case 'STAFF': return 'tint-orange';
      case 'GRIEVANCES': return 'tint-rose';
      case 'APPEALS': case 'LEGAL': case 'CONTENT': return 'tint-violet';
      case 'FINANCE': return 'tint-green';
      case 'BILLING': return 'tint-amber';
      default: return 'tint-cyan';
    }
  }
}
