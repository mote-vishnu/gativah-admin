import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import { AuditEntryRow, ClubDetail, ClubEventDetail, ClubMemberRow, ClubReportedContent, ClubStats, ClubSummary, Page } from './models';

@Injectable({ providedIn: 'root' })
export class ClubsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/clubs`;

  list(opts: { q?: string | null; visibility?: string | string[] | null; status?: string | string[] | null; sort?: string | null; page?: number; size?: number }): Observable<Page<ClubSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.sort) { params = params.set('sort', opts.sort); }
    params = appendMulti(params, 'visibility', opts.visibility);
    params = appendMulti(params, 'status', opts.status);
    return this.http.get<Page<ClubSummary>>(this.base, { params });
  }

  stats(): Observable<ClubStats> {
    return this.http.get<ClubStats>(`${this.base}/stats`);
  }

  detail(id: number): Observable<ClubDetail> {
    return this.http.get<ClubDetail>(`${this.base}/${id}`);
  }

  audit(id: number, page = 0, size = 25): Observable<Page<AuditEntryRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditEntryRow>>(`${this.base}/${id}/audit`, { params });
  }

  members(id: number, opts: { role?: string | null; status?: string | null; q?: string | null; page?: number; size?: number }): Observable<Page<ClubMemberRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.role) { params = params.set('role', opts.role); }
    if (opts.status) { params = params.set('status', opts.status); }
    if (opts.q) { params = params.set('q', opts.q); }
    return this.http.get<Page<ClubMemberRow>>(`${this.base}/${id}/members`, { params });
  }


  remove(id: number, reason: string | null): Observable<ClubDetail> {
    return this.http.post<ClubDetail>(`${this.base}/${id}/remove`, { reason });
  }

  restore(id: number): Observable<ClubDetail> {
    return this.http.post<ClubDetail>(`${this.base}/${id}/restore`, {});
  }

  removeMember(id: number, userId: number): Observable<ClubDetail> {
    return this.http.post<ClubDetail>(`${this.base}/${id}/members/${userId}/remove`, {});
  }

  removeEvent(id: number, eventId: number, reason: string | null): Observable<ClubDetail> {
    return this.http.post<ClubDetail>(`${this.base}/${id}/events/${eventId}/remove`, { reason });
  }

  reportedContent(id: number): Observable<{ items: ClubReportedContent[] }> {
    return this.http.get<{ items: ClubReportedContent[] }>(`${this.base}/${id}/reported`);
  }

  eventDetail(id: number, eventId: number): Observable<ClubEventDetail> {
    return this.http.get<ClubEventDetail>(`${this.base}/${id}/events/${eventId}`);
  }

  restoreEvent(id: number, eventId: number): Observable<ClubEventDetail> {
    return this.http.post<ClubEventDetail>(`${this.base}/${id}/events/${eventId}/restore`, {});
  }
}
