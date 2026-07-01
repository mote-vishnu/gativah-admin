import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { IconComponent } from '../../shared/icon';
import { TableColumn, TableComponent } from '../../shared/table';
import { SubscriptionInfo, UserBilling } from '../../core/models';

/** Profile Billing tab: lifetime value, current plan, refunds + transaction history. */
@Component({
  selector: 'app-user-billing-tab',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, IconComponent, TableComponent],
  template: `
    <div class="row g3" style="margin-bottom:18px">
      <div class="card kpi"><div class="lab"><span class="ic tint-orange"><lucide-icon name="dollar-sign" [size]="16" /></span> Lifetime value</div><div class="val c-orange">{{ money(billing()?.lifetimeValue, billing()?.currency) }}</div><div class="delta flat">{{ billing()?.transactions ?? 0 }} transactions</div></div>
      <div class="card kpi"><div class="lab"><span class="ic tint-green"><lucide-icon name="credit-card" [size]="16" /></span> Current plan</div><div class="val" style="font-size:20px">{{ sub()?.planCode || 'Free' }}</div><div class="delta flat">{{ sub() ? ((sub()!.state | titlecase) + (sub()!.currentPeriodEnd ? ' · renews ' + (sub()!.currentPeriodEnd | date: 'MMM y') : '')) : 'no subscription' }}</div></div>
      <div class="card kpi"><div class="lab"><span class="ic tint-rose"><lucide-icon name="receipt-text" [size]="16" /></span> Refunds</div><div class="val" [class.c-rose]="(billing()?.refunds ?? 0) > 0">{{ billing()?.refunds ?? 0 }}</div><div class="delta flat">lifetime</div></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>Transactions</h3><span class="hint">most recent first</span></div>
      <ui-table [columns]="cols" [flush]="true" [empty]="(billing()?.items?.length ?? 0) === 0" emptyText="No transactions.">
        @for (t of billing()?.items ?? []; track t.id) {
          <tr>
            <td class="mono">#{{ t.id }}</td>
            <td><span class="pill" [class]="typeClass(t.type)">{{ t.type | titlecase }}</span></td>
            <td><span class="pill" [class]="statusClass(t.status)">{{ t.status | titlecase }}</span></td>
            <td><b>{{ money(t.amount, t.currency) }}</b></td>
            <td class="muted">{{ t.platform | titlecase }}</td>
            <td class="muted">{{ t.purchasedAt ? (t.purchasedAt | date: 'MMM d, y') : '—' }}</td>
          </tr>
        }
      </ui-table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .kpi .val.c-orange { color: var(--brand); } .kpi .val.c-rose { color: var(--rose); }
  `,
})
export class UserBillingTabComponent {
  readonly billing = input<UserBilling | null>(null);
  readonly sub = input<SubscriptionInfo | null>(null);

  readonly cols: TableColumn[] = [
    { label: 'Txn' }, { label: 'Type' }, { label: 'Status' }, { label: 'Amount' }, { label: 'Platform' }, { label: 'Date' },
  ];

  money(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount == null) { return '—'; }
    try {
      return amount.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD' });
    } catch {
      return (currency || '') + ' ' + amount.toFixed(2);
    }
  }

  typeClass(t: string): string {
    return /REFUND/i.test(t) ? 'banned' : /RENEWAL/i.test(t) ? 'resolved' : 'review';
  }

  statusClass(s: string): string {
    return /VALID|ACTIVE|PAID/i.test(s) ? 'active' : /REFUND|FAIL|EXPIRED/i.test(s) ? 'banned' : 'pending';
  }
}
