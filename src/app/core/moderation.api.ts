import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import {
  AppealResolveRequest,
  AppealRow,
  AssignRequest,
  AuthorHistory,
  AutoFlagSignal,
  BulkAssignRequest,
  BulkResolveRequest,
  BulkResolveResponse,
  ModerationActionRow,
  Page,
  ReasonCount,
  RegionBanRow,
  ReportStats,
  ReportDetail,
  ReportSummary,
  ResolveRequest,
  ResolveResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class ModerationApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin`;

  reports(opts: {
    status?: string | string[] | null;
    contentType?: string | null;
    reason?: string | null;
    sort?: string | null;
    page?: number;
    size?: number;
  }): Observable<Page<ReportSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    params = appendMulti(params, 'status', opts.status);
    if (opts.contentType) params = params.set('contentType', opts.contentType);
    if (opts.reason) params = params.set('reason', opts.reason);
    if (opts.sort) params = params.set('sort', opts.sort);
    return this.http.get<Page<ReportSummary>>(`${this.base}/reports`, { params });
  }

  report(id: number): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${this.base}/reports/${id}`);
  }

  resolve(id: number, req: ResolveRequest): Observable<ResolveResponse> {
    return this.http.post<ResolveResponse>(`${this.base}/reports/${id}/resolve`, req);
  }

  bulkResolve(req: BulkResolveRequest): Observable<BulkResolveResponse> {
    return this.http.post<BulkResolveResponse>(`${this.base}/reports/bulk-resolve`, req);
  }

  assign(id: number, req: AssignRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/reports/${id}/assign`, req);
  }

  bulkAssign(req: BulkAssignRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/reports/bulk-assign`, req);
  }

  byReason(): Observable<{ items: ReasonCount[] }> {
    return this.http.get<{ items: ReasonCount[] }>(`${this.base}/reports/by-reason`);
  }

  stats(): Observable<ReportStats> {
    return this.http.get<ReportStats>(`${this.base}/reports/stats`);
  }

  regionBans(): Observable<{ items: RegionBanRow[] }> {
    return this.http.get<{ items: RegionBanRow[] }>(`${this.base}/region-bans`);
  }

  liftRegionBan(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/region-bans/${id}/lift`, {});
  }

  timeline(id: number): Observable<{ items: ModerationActionRow[] }> {
    return this.http.get<{ items: ModerationActionRow[] }>(`${this.base}/reports/${id}/timeline`);
  }

  authorHistory(id: number): Observable<AuthorHistory> {
    return this.http.get<AuthorHistory>(`${this.base}/reports/${id}/author-history`);
  }

  signals(id: number): Observable<{ items: AutoFlagSignal[] }> {
    return this.http.get<{ items: AutoFlagSignal[] }>(`${this.base}/reports/${id}/signals`);
  }

  history(page = 0, size = 20): Observable<Page<ModerationActionRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ModerationActionRow>>(`${this.base}/moderation/history`, { params });
  }

  appeals(status: string | null, page = 0, size = 20): Observable<Page<AppealRow>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) { params = params.set('status', status); }
    return this.http.get<Page<AppealRow>>(`${this.base}/appeals`, { params });
  }

  resolveAppeal(id: number, req: AppealResolveRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/appeals/${id}/resolve`, req);
  }
}
