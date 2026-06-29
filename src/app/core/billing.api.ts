import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { EntitlementDef, EntitlementRow, GrantCompRequest, Page, RefundRow } from './models';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/billing`;

  entitlements(opts: { q?: string | null; source?: string | null; page?: number; size?: number }): Observable<Page<EntitlementRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.source) { params = params.set('source', opts.source); }
    return this.http.get<Page<EntitlementRow>>(`${this.base}/entitlements`, { params });
  }

  refunds(page = 0, size = 20): Observable<Page<RefundRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<RefundRow>>(`${this.base}/refunds`, { params });
  }

  defs(): Observable<{ defs: EntitlementDef[] }> {
    return this.http.get<{ defs: EntitlementDef[] }>(`${this.base}/entitlement-defs`);
  }

  grantComp(req: GrantCompRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/entitlements/comp`, req);
  }

  revokeComp(userId: number, code: string): Observable<void> {
    return this.http.post<void>(`${this.base}/entitlements/revoke`, { userId, code });
  }
}
