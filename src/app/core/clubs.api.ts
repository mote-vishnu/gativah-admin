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

  list(opts: { q?: string | null; visibility?: string | string[] | null; status?: string | string[] | null; page?: number; size?: number }): Observable<Page<ClubSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    params = appendMulti(params, 'visibility', opts.visibility);
    params = appendMulti(params, 'status', opts.status);
    return this.http.get<Page<ClubSummary>>(this.base, { params });
  }

  detail(id: number): Observable<ClubDetail> {
    return this.http.get<ClubDetail>(`${this.base}/${id}`);
  }
}
