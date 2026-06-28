import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import {
  FinanceOverview,
  FinanceRevenueResponse,
  Page,
  SubscriptionRow,
  TransactionRow,
  WebhookHealth,
} from './models';

@Injectable({ providedIn: 'root' })
export class FinanceApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/finance`;

  overview(): Observable<FinanceOverview> {
    return this.http.get<FinanceOverview>(`${this.base}/overview`);
  }

  revenue(granularity = 'month', groupBy?: string | null): Observable<FinanceRevenueResponse> {
    let params = new HttpParams().set('granularity', granularity);
    if (groupBy) params = params.set('groupBy', groupBy);
    return this.http.get<FinanceRevenueResponse>(`${this.base}/revenue`, { params });
  }

  transactions(opts: { type?: string | null; page?: number; size?: number }): Observable<Page<TransactionRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.type) params = params.set('type', opts.type);
    return this.http.get<Page<TransactionRow>>(`${this.base}/transactions`, { params });
  }

  subscriptions(state?: string | null, page = 0, size = 20): Observable<Page<SubscriptionRow>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (state) params = params.set('state', state);
    return this.http.get<Page<SubscriptionRow>>(`${this.base}/subscriptions`, { params });
  }

  webhooks(): Observable<WebhookHealth> {
    return this.http.get<WebhookHealth>(`${this.base}/webhooks`);
  }
}
