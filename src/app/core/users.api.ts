import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import { AuditEntryRow, BanUserRequest, Page, SuspendUserRequest, UserDetail, UserInsights, UserSummary } from './models';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/users`;

  list(opts: { q?: string | null; status?: string | string[] | null; sort?: string | null; page?: number; size?: number }): Observable<Page<UserSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.sort) { params = params.set('sort', opts.sort); }
    params = appendMulti(params, 'status', opts.status);
    return this.http.get<Page<UserSummary>>(this.base, { params });
  }

  detail(id: number): Observable<UserDetail> {
    return this.http.get<UserDetail>(`${this.base}/${id}`);
  }

  suspend(id: number, req: SuspendUserRequest): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/${id}/suspend`, req);
  }

  ban(id: number, req: BanUserRequest): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/${id}/ban`, req);
  }

  reinstate(id: number): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/${id}/reinstate`, {});
  }

  setVerified(id: number, grant: boolean): Observable<UserDetail> {
    return this.http.post<UserDetail>(`${this.base}/${id}/verified`, { grant });
  }

  insights(id: number): Observable<UserInsights> {
    return this.http.get<UserInsights>(`${this.base}/${id}/insights`);
  }

  audit(id: number, page = 0, size = 25): Observable<Page<AuditEntryRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditEntryRow>>(`${this.base}/${id}/audit`, { params });
  }
}
