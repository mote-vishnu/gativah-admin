import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import {
  ModerationActionRow,
  Page,
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
    status?: string | null;
    contentType?: string | null;
    reason?: string | null;
    page?: number;
    size?: number;
  }): Observable<Page<ReportSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.contentType) params = params.set('contentType', opts.contentType);
    if (opts.reason) params = params.set('reason', opts.reason);
    return this.http.get<Page<ReportSummary>>(`${this.base}/reports`, { params });
  }

  report(id: number): Observable<ReportDetail> {
    return this.http.get<ReportDetail>(`${this.base}/reports/${id}`);
  }

  resolve(id: number, req: ResolveRequest): Observable<ResolveResponse> {
    return this.http.post<ResolveResponse>(`${this.base}/reports/${id}/resolve`, req);
  }

  history(page = 0, size = 20): Observable<Page<ModerationActionRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ModerationActionRow>>(`${this.base}/moderation/history`, { params });
  }
}
