import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import { ContentRow, Page, TakedownContentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/content`;

  list(opts: { type?: string | string[] | null; q?: string | null; status?: string | string[] | null; page?: number; size?: number }): Observable<Page<ContentRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    params = appendMulti(params, 'type', opts.type);
    if (opts.q) { params = params.set('q', opts.q); }
    params = appendMulti(params, 'status', opts.status);
    return this.http.get<Page<ContentRow>>(this.base, { params });
  }

  takedown(type: string, id: number, req: TakedownContentRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${type}/${id}/takedown`, req);
  }
}
