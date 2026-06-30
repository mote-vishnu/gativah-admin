import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import {
  FinanceOverview,
  FinanceRevenueResponse,
  MrrMovement,
  Page,
  PayoutsResponse,
  SubscriptionRow,
  TransactionDetail,
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

  mrrMovement(): Observable<MrrMovement> {
    return this.http.get<MrrMovement>(`${this.base}/mrr-movement`);
  }

  payouts(windowDays = 30): Observable<PayoutsResponse> {
    return this.http.get<PayoutsResponse>(`${this.base}/payouts`, { params: new HttpParams().set('windowDays', windowDays) });
  }

  revenue(granularity = 'month', groupBy?: string | null, from?: string | null, to?: string | null): Observable<FinanceRevenueResponse> {
    let params = new HttpParams().set('granularity', granularity);
    if (groupBy) params = params.set('groupBy', groupBy);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<FinanceRevenueResponse>(`${this.base}/revenue`, { params });
  }

  transactions(opts: { type?: string | null; platform?: string | null; country?: string | null; sort?: string | null; page?: number; size?: number }): Observable<Page<TransactionRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.type) params = params.set('type', opts.type);
    if (opts.platform) params = params.set('platform', opts.platform);
    if (opts.country) params = params.set('country', opts.country);
    if (opts.sort) params = params.set('sort', opts.sort);
    return this.http.get<Page<TransactionRow>>(`${this.base}/transactions`, { params });
  }

  transaction(id: number): Observable<TransactionDetail> {
    return this.http.get<TransactionDetail>(`${this.base}/transactions/${id}`);
  }

  subscriptions(opts: { state?: string | null; sort?: string | null; page?: number; size?: number }): Observable<Page<SubscriptionRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.state) params = params.set('state', opts.state);
    if (opts.sort) params = params.set('sort', opts.sort);
    return this.http.get<Page<SubscriptionRow>>(`${this.base}/subscriptions`, { params });
  }

  webhooks(): Observable<WebhookHealth> {
    return this.http.get<WebhookHealth>(`${this.base}/webhooks`);
  }
}
