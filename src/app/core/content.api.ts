import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import { ContentDetail, ContentReportRef, ContentRow, ContentStats, Page, StoryRow, TakedownContentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/content`;

  list(opts: { type?: string | string[] | null; q?: string | null; status?: string | string[] | null; reported?: boolean; page?: number; size?: number }): Observable<Page<ContentRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    params = appendMulti(params, 'type', opts.type);
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.reported) { params = params.set('reported', true); }
    params = appendMulti(params, 'status', opts.status);
    return this.http.get<Page<ContentRow>>(this.base, { params });
  }

  stats(): Observable<ContentStats> {
    return this.http.get<ContentStats>(`${this.base}/stats`);
  }

  reports(type: string, id: number): Observable<{ reports: ContentReportRef[] }> {
    return this.http.get<{ reports: ContentReportRef[] }>(`${this.base}/${type}/${id}/reports`);
  }

  detail(type: string, id: number): Observable<ContentDetail> {
    return this.http.get<ContentDetail>(`${this.base}/${type}/${id}/detail`);
  }

  stories(opts: { q?: string | null; page?: number; size?: number }): Observable<Page<StoryRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    return this.http.get<Page<StoryRow>>(`${this.base}/stories`, { params });
  }

  takedown(type: string, id: number, req: TakedownContentRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${type}/${id}/takedown`, req);
  }
}
