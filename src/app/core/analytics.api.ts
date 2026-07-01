import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import {
  ActiveUsersResponse,
  EngagementResponse,
  EventBreakdownResponse,
  FunnelResponse,
  GeoResponse,
  OverviewKpis,
  PlatformResponse,
  RetentionResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/analytics`;

  overview(days: number): Observable<OverviewKpis> {
    return this.http.get<OverviewKpis>(`${this.base}/overview`, { params: this.days(days) });
  }

  activeUsers(days: number): Observable<ActiveUsersResponse> {
    return this.http.get<ActiveUsersResponse>(`${this.base}/active-users`, { params: this.days(days) });
  }

  events(days: number): Observable<EventBreakdownResponse> {
    return this.http.get<EventBreakdownResponse>(`${this.base}/events`, { params: this.days(days) });
  }

  engagement(days: number): Observable<EngagementResponse> {
    return this.http.get<EngagementResponse>(`${this.base}/engagement`, { params: this.days(days) });
  }

  retention(weeks: number): Observable<RetentionResponse> {
    return this.http.get<RetentionResponse>(`${this.base}/retention`, { params: new HttpParams().set('weeks', weeks) });
  }

  platforms(days: number): Observable<PlatformResponse> {
    return this.http.get<PlatformResponse>(`${this.base}/platforms`, { params: this.days(days) });
  }

  funnel(days: number): Observable<FunnelResponse> {
    return this.http.get<FunnelResponse>(`${this.base}/funnel`, { params: this.days(days) });
  }

  geo(): Observable<GeoResponse> {
    return this.http.get<GeoResponse>(`${this.base}/geo`);
  }

  private days(days: number): HttpParams {
    return new HttpParams().set('days', days);
  }
}
