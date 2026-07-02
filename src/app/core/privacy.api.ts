import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { DsarDetail, DsarStats, DsarSummary, Page, PrivacySettings } from './models';

@Injectable({ providedIn: 'root' })
export class PrivacyApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/privacy`;

  list(opts: {
    q?: string | null;
    status?: string[];
    type?: string[];
    overdueOnly?: boolean;
    page?: number;
    size?: number;
  }): Observable<Page<DsarSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    (opts.status ?? []).forEach((s) => { params = params.append('status', s); });
    (opts.type ?? []).forEach((t) => { params = params.append('type', t); });
    if (opts.overdueOnly) { params = params.set('overdueOnly', true); }
    return this.http.get<Page<DsarSummary>>(`${this.base}/requests`, { params });
  }

  stats(): Observable<DsarStats> {
    return this.http.get<DsarStats>(`${this.base}/stats`);
  }

  detail(id: number): Observable<DsarDetail> {
    return this.http.get<DsarDetail>(`${this.base}/requests/${id}`);
  }

  update(id: number, req: { status?: string; notes?: string; version: number }): Observable<DsarSummary> {
    return this.http.patch<DsarSummary>(`${this.base}/requests/${id}`, req);
  }

  verify(id: number, verified: boolean, note?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/verify`, { verified, note });
  }

  executeErasure(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/execute-erasure`, {});
  }

  recordExport(id: number, exportUri: string, note?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/export`, { exportUri, note });
  }

  resolve(id: number, resolution: string, note?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/resolve`, { resolution, note });
  }

  addNote(id: number, note: string): Observable<void> {
    return this.http.post<void>(`${this.base}/requests/${id}/notes`, { note });
  }

  settings(): Observable<PrivacySettings> {
    return this.http.get<PrivacySettings>(`${this.base}/settings`);
  }

  updateSettings(erasureRetentionDays: number): Observable<PrivacySettings> {
    return this.http.put<PrivacySettings>(`${this.base}/settings`, { erasureRetentionDays });
  }
}
