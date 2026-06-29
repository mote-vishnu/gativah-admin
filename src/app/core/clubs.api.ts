import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import { ClubDetail, ClubSummary, Page } from './models';

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

  detail(id: number): Observable<ClubDetail> {
    return this.http.get<ClubDetail>(`${this.base}/${id}`);
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
}
