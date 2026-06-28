import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import {
  AssignRolesRequest,
  AuditEntryRow,
  CreateLegalRequest,
  CreateRoleRequest,
  DisclosureRow,
  InviteStaffRequest,
  LegalRequestDetail,
  LegalRequestSummary,
  MfaStart,
  MfaStatus,
  Page,
  PermissionCatalogResponse,
  RecordDisclosureRequest,
  RoleResponse,
  RolesResponse,
  StaffRow,
  UpdateLegalRequest,
  UpdateRoleRequest,
  UpdateStaffRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(page = 0, size = 25): Observable<Page<AuditEntryRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditEntryRow>>(`${API_BASE_URL}/admin/audit`, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/staff`;

  list(page = 0, size = 25): Observable<Page<StaffRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<StaffRow>>(this.base, { params });
  }

  invite(req: InviteStaffRequest): Observable<StaffRow> {
    return this.http.post<StaffRow>(this.base, req);
  }

  update(id: number, req: UpdateStaffRequest): Observable<StaffRow> {
    return this.http.patch<StaffRow>(`${this.base}/${id}`, req);
  }

  setRoles(id: number, req: AssignRolesRequest): Observable<StaffRow> {
    return this.http.patch<StaffRow>(`${this.base}/${id}/roles`, req);
  }
}

@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/roles`;

  list(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>(this.base);
  }

  catalog(): Observable<PermissionCatalogResponse> {
    return this.http.get<PermissionCatalogResponse>(`${API_BASE_URL}/admin/permissions`);
  }

  create(req: CreateRoleRequest): Observable<RoleResponse> {
    return this.http.post<RoleResponse>(this.base, req);
  }

  update(id: number, req: UpdateRoleRequest): Observable<RoleResponse> {
    return this.http.patch<RoleResponse>(`${this.base}/${id}`, req);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class LegalApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/legal/requests`;

  list(status: string | string[] | null, page = 0, size = 20): Observable<Page<LegalRequestSummary>> {
    let params = new HttpParams().set('page', page).set('size', size);
    params = appendMulti(params, 'status', status);
    return this.http.get<Page<LegalRequestSummary>>(this.base, { params });
  }

  detail(id: number): Observable<LegalRequestDetail> {
    return this.http.get<LegalRequestDetail>(`${this.base}/${id}`);
  }

  create(req: CreateLegalRequest): Observable<LegalRequestSummary> {
    return this.http.post<LegalRequestSummary>(this.base, req);
  }

  update(id: number, req: UpdateLegalRequest): Observable<LegalRequestSummary> {
    return this.http.patch<LegalRequestSummary>(`${this.base}/${id}`, req);
  }

  recordDisclosure(id: number, req: RecordDisclosureRequest): Observable<DisclosureRow> {
    return this.http.post<DisclosureRow>(`${this.base}/${id}/disclosures`, req);
  }
}

@Injectable({ providedIn: 'root' })
export class MfaApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/me/mfa`;

  status(): Observable<MfaStatus> {
    return this.http.get<MfaStatus>(`${this.base}/status`);
  }

  start(): Observable<MfaStart> {
    return this.http.post<MfaStart>(`${this.base}/start`, {});
  }

  enable(code: string): Observable<MfaStatus> {
    return this.http.post<MfaStatus>(`${this.base}/enable`, { code });
  }
}

