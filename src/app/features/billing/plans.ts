import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../shared/icon';
import { InputComponent, MultiSelectComponent, SelectComponent, SelectOption, TextareaComponent } from '../../shared/forms';
import { PageHeaderComponent } from '../../shared/page-header';
import { BillingApi } from '../../core/billing.api';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { EntitlementDef, PlanRow, PlanUpsertRequest } from '../../core/models';

const FAMILY_OPTS: SelectOption[] = [
  { value: 'PLUS', label: 'Plus' },
  { value: 'VERIFIED', label: 'Verified' },
];
const PERIOD_OPTS: SelectOption[] = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'SEMIANNUAL', label: 'Semi-annual' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'LIFETIME', label: 'Lifetime' },
];

type Draft = {
  code: string; name: string; productFamily: string; period: string; entitlements: string[];
  priceAmount: string; priceCurrency: string; badge: string; sortOrder: string; description: string;
  storeProductIdIos: string; storeProductIdAndroid: string; basePlanIdAndroid: string; active: boolean;
};
const EMPTY: Draft = {
  code: '', name: '', productFamily: 'PLUS', period: 'ANNUAL', entitlements: ['plus'],
  priceAmount: '', priceCurrency: 'USD', badge: '', sortOrder: '0', description: '',
  storeProductIdIos: '', storeProductIdAndroid: '', basePlanIdAndroid: '', active: true,
};

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    FormsModule, TitleCasePipe, IconComponent,
    InputComponent, SelectComponent, MultiSelectComponent, TextareaComponent, PageHeaderComponent,
  ],
  template: `
    <ui-page-header eyebrow="Billing" icon="credit-card" title="Subscription plans"
      subtitle="Catalog, pricing copy & entitlements — change without an app release">
      @if (canEdit()) {
        <div class="hact" page-actions>
          <button class="btn" (click)="openNew()"><lucide-icon name="plus" [size]="15" /> New plan</button>
        </div>
      }
    </ui-page-header>

    <div class="subtabs" role="tablist">
      <button role="tab" [class.on]="tab() === 'active'" (click)="tab.set('active')">Active · {{ activeCount() }}</button>
      <button role="tab" [class.on]="tab() === 'archived'" (click)="tab.set('archived')">Archived · {{ inactiveCount() }}</button>
    </div>

    @if (loading()) {
      <div class="muted pad">Loading plans…</div>
    } @else {
      <div class="plangrid">
        @for (p of visible(); track p.id) {
          <div class="plan" [class.feat]="!!p.badge && p.active" [class.off]="!p.active"
            [class.clickable]="canEdit()" (click)="edit(p)">
            @if (canEdit()) { <span class="ed"><lucide-icon name="pencil" [size]="12" /> Edit</span> }
            @if (p.badge) { <span class="pbadge">{{ p.badge }}</span> }
            <div class="fam">{{ p.productFamily | titlecase }}</div>
            <div class="pname">{{ p.name }}</div>
            <div class="price">{{ priceText(p) }}<small>{{ periodSuffix(p.period) }}</small></div>
            <div class="pcode">{{ p.storeProductIdIos || p.code }}</div>
            <ul>
              @for (e of entList(p); track e) { <li>{{ e }}</li> }
            </ul>
            @if (!p.active) { <span class="pill banned off-pill">Archived</span> }
          </div>
        }
        @if (tab() === 'active' && canEdit()) {
          <button class="plan add" (click)="openNew()"><lucide-icon name="plus" [size]="18" /> Add plan</button>
        }
      </div>
      @if (visible().length === 0) {
        <div class="muted pad">
          {{ tab() === 'archived' ? 'No archived plans — deactivated plans appear here.' : 'No active plans yet.' }}
        </div>
      }
      @if (tab() === 'active') {
        <p class="note"><lucide-icon name="triangle-alert" [size]="13" /> Price &amp; copy edits write via the internal hook; store product IDs mirror App Store / Play.</p>
      }
    }

    @if (draft(); as d) {
      <div class="drawer-scrim" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-label="Plan editor">
        <header class="drawer-h">
          <div><span class="pill">{{ editingId() ? 'Edit' : 'New' }}</span><h2>{{ d.name || 'Subscription plan' }}</h2></div>
          <button class="iconbtn" (click)="close()" aria-label="Close"><lucide-icon name="x" [size]="18" /></button>
        </header>

        <div class="form">
          <div class="grid2">
            <ui-input label="Code" hint="Unique key (e.g. plus_annual)" [(ngModel)]="d.code" />
            <ui-input label="Name" [(ngModel)]="d.name" />
            <ui-select label="Product family" [options]="familyOpts" [(ngModel)]="d.productFamily" />
            <ui-select label="Billing period" [options]="periodOpts" [(ngModel)]="d.period" />
            <ui-input label="Price (display)" type="number" [(ngModel)]="d.priceAmount" />
            <ui-input label="Currency" [(ngModel)]="d.priceCurrency" />
            <ui-input label="Badge" hint="e.g. BEST VALUE" [(ngModel)]="d.badge" />
            <ui-input label="Sort order" type="number" [(ngModel)]="d.sortOrder" />
          </div>
          <ui-multiselect label="Entitlements granted" [options]="entOpts()" [(ngModel)]="d.entitlements" />
          <ui-textarea label="Description" [rows]="2" [(ngModel)]="d.description" />
          <h4 class="sub">Store product mapping</h4>
          <div class="grid2">
            <ui-input label="iOS product id" [(ngModel)]="d.storeProductIdIos" />
            <ui-input label="Android product id" [(ngModel)]="d.storeProductIdAndroid" />
            <ui-input label="Android base plan id" [(ngModel)]="d.basePlanIdAndroid" />
          </div>
          <label class="chk"><input type="checkbox" [(ngModel)]="d.active" /> Active (shown on the paywall)</label>

          <div class="drawer-act">
            <button class="btn full" (click)="save()" [disabled]="saving() || !d.code || !d.name || d.entitlements.length === 0">
              {{ editingId() ? 'Save changes' : 'Create plan' }}
            </button>
            @if (editingId(); as id) {
              <button class="btn ghost full" (click)="toggleActive(id, !d.active)" [disabled]="saving()">
                {{ d.active ? 'Deactivate' : 'Activate' }} plan
              </button>
            }
          </div>
        </div>
      </aside>
    }
  `,
  styleUrl: './plans.scss',
})
export class PlansComponent implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly canEdit = computed(() => this.auth.can('BILLING:EDIT'));
  readonly familyOpts = FAMILY_OPTS;
  readonly periodOpts = PERIOD_OPTS;

  readonly plans = signal<PlanRow[]>([]);
  readonly entOpts = signal<SelectOption[]>([]);
  readonly defName = signal<Record<string, string>>({});
  readonly tab = signal<'active' | 'archived'>('active');

  readonly activeCount = computed(() => this.plans().filter((p) => p.active).length);
  readonly inactiveCount = computed(() => this.plans().filter((p) => !p.active).length);
  readonly visible = computed(() =>
    this.plans().filter((p) => (this.tab() === 'active' ? p.active : !p.active)));
  readonly draft = signal<Draft | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.load();
    this.api.defs().subscribe((r) => {
      this.entOpts.set(r.defs.map((d: EntitlementDef) => ({ value: d.code, label: `${d.name} (${d.code})` })));
      this.defName.set(Object.fromEntries(r.defs.map((d: EntitlementDef) => [d.code, d.name])));
    });
  }

  /** Feature bullets for a plan card — entitlement codes mapped to their friendly names. */
  entList(p: PlanRow): string[] {
    const names = this.defName();
    return (p.entitlements ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((c) => names[c] ?? c);
  }

  priceText(p: PlanRow): string {
    if (p.priceAmount == null) return '—';
    const amt = p.priceAmount.toFixed(2);
    return p.priceCurrency ? `${p.priceCurrency} ${amt}` : amt;
  }

  periodSuffix(period: string): string {
    switch (period) {
      case 'ANNUAL': return '/yr';
      case 'SEMIANNUAL': return '/6mo';
      case 'QUARTERLY': return '/qtr';
      case 'MONTHLY': return '/mo';
      case 'LIFETIME': return ' one-time';
      default: return '';
    }
  }

  private load(): void {
    this.loading.set(true);
    this.api.plans().subscribe({
      next: (r) => { this.plans.set(r.plans); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.editingId.set(null);
    this.draft.set({ ...EMPTY, entitlements: ['plus'] });
  }

  edit(p: PlanRow): void {
    if (!this.canEdit()) return;
    this.editingId.set(p.id);
    this.draft.set({
      code: p.code, name: p.name, productFamily: p.productFamily, period: p.period,
      entitlements: p.entitlements ? p.entitlements.split(',').map((s) => s.trim()).filter(Boolean) : [],
      priceAmount: p.priceAmount == null ? '' : String(p.priceAmount), priceCurrency: p.priceCurrency ?? '',
      badge: p.badge ?? '', sortOrder: String(p.sortOrder), description: p.description ?? '',
      storeProductIdIos: p.storeProductIdIos ?? '', storeProductIdAndroid: p.storeProductIdAndroid ?? '',
      basePlanIdAndroid: p.basePlanIdAndroid ?? '', active: p.active,
    });
  }

  close(): void { this.draft.set(null); this.editingId.set(null); }

  save(): void {
    const d = this.draft();
    if (!d) return;
    const req: PlanUpsertRequest = {
      code: d.code.trim(), name: d.name.trim(), productFamily: d.productFamily, period: d.period,
      entitlements: d.entitlements.join(','),
      priceAmount: d.priceAmount ? Number(d.priceAmount) : null,
      priceCurrency: d.priceCurrency.trim() || null,
      badge: d.badge.trim() || null,
      sortOrder: Number(d.sortOrder) || 0,
      description: d.description.trim() || null,
      storeProductIdIos: d.storeProductIdIos.trim() || null,
      storeProductIdAndroid: d.storeProductIdAndroid.trim() || null,
      basePlanIdAndroid: d.basePlanIdAndroid.trim() || null,
      active: d.active,
    };
    this.saving.set(true);
    const id = this.editingId();
    const call = id ? this.api.updatePlan(id, req) : this.api.createPlan(req);
    call.subscribe({
      next: () => { this.saving.set(false); this.toast.success(id ? 'Plan updated.' : 'Plan created.'); this.close(); this.load(); },
      error: () => { this.saving.set(false); this.toast.error('Could not save the plan.'); },
    });
  }

  async toggleActive(id: number, active: boolean): Promise<void> {
    const r = await this.confirm.confirm({
      title: active ? 'Activate plan?' : 'Deactivate plan?',
      message: active ? 'It will appear on the paywall.' : 'It will be hidden from the paywall (existing subscribers keep access).',
      confirmLabel: active ? 'Activate' : 'Deactivate',
      tone: active ? 'default' : 'danger',
    });
    if (!r.confirmed) return;
    this.saving.set(true);
    this.api.setPlanActive(id, active).subscribe({
      next: () => { this.saving.set(false); this.toast.success(active ? 'Plan activated.' : 'Plan deactivated.'); this.close(); this.load(); },
      error: () => { this.saving.set(false); this.toast.error('Could not update the plan.'); },
    });
  }
}
