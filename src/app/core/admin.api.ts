import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './environment';
import { appendMulti } from './http-params.util';
import {
  AssignRolesRequest,
  ActiveSessionRow,
  AuditEntryRow,
  AuditStats,
  CreateLegalRequest,
  SecurityOverview,
  CreateRoleRequest,
  DisclosureRegisterRow,
  DisclosureRow,
  InviteStaffRequest,
  LegalRequestDetail,
  LegalRequestSummary,
  LegalStats,
  LegalTaskListRow,
  BackupCodes,
  MfaEnableResult,
  MfaStart,
  MfaStatus,
  Page,
  PermissionCatalogResponse,
  RecordDisclosureRequest,
  RoleResponse,
  RolesResponse,
  SessionRow,
  StaffRow,
  UpdateLegalRequest,
  UpdateRoleRequest,
  UpdateStaffRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(opts: { actorId?: number | null; action?: string | null; category?: string | null; q?: string | null; from?: string | null; to?: string | null; page?: number; size?: number } = {}): Observable<Page<AuditEntryRow>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 25);
    if (opts.actorId != null) { params = params.set('actorId', opts.actorId); }
    if (opts.action) { params = params.set('action', opts.action); }
    if (opts.category) { params = params.set('category', opts.category); }
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.from) { params = params.set('from', opts.from); }
    if (opts.to) { params = params.set('to', opts.to); }
    return this.http.get<Page<AuditEntryRow>>(`${API_BASE_URL}/admin/audit`, { params });
  }

  stats(actorId?: number | null): Observable<AuditStats> {
    let params = new HttpParams();
    if (actorId != null) { params = params.set('actorId', actorId); }
    return this.http.get<AuditStats>(`${API_BASE_URL}/admin/audit/stats`, { params });
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

  get(id: number): Observable<StaffRow> {
    return this.http.get<StaffRow>(`${this.base}/${id}`);
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

  resetMfa(id: number): Observable<StaffRow> {
    return this.http.post<StaffRow>(`${this.base}/${id}/mfa/reset`, {});
  }

  sessions(id: number): Observable<{ items: SessionRow[] }> {
    return this.http.get<{ items: SessionRow[] }>(`${this.base}/${id}/sessions`);
  }

  revokeSession(id: number, sessionId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/sessions/${sessionId}/revoke`, {});
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

  list(opts: { q?: string | null; status?: string | string[] | null; type?: string | string[] | null; overdue?: boolean; page?: number; size?: number }): Observable<Page<LegalRequestSummary>> {
    let params = new HttpParams().set('page', opts.page ?? 0).set('size', opts.size ?? 20);
    if (opts.q) { params = params.set('q', opts.q); }
    if (opts.overdue) { params = params.set('overdue', true); }
    params = appendMulti(params, 'status', opts.status);
    params = appendMulti(params, 'type', opts.type);
    return this.http.get<Page<LegalRequestSummary>>(this.base, { params });
  }

  stats(): Observable<LegalStats> {
    return this.http.get<LegalStats>(`${API_BASE_URL}/admin/legal/stats`);
  }

  openTasks(page = 0, size = 25): Observable<Page<LegalTaskListRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<LegalTaskListRow>>(`${API_BASE_URL}/admin/legal/tasks`, { params });
  }

  disclosureRegister(page = 0, size = 25): Observable<Page<DisclosureRegisterRow>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<DisclosureRegisterRow>>(`${API_BASE_URL}/admin/legal/disclosures`, { params });
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

  approve(id: number, approve: boolean, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/approve`, { approve, note });
  }

  addTask(id: number, req: { title: string; assigneeAdminId: number | null; dueAt: string | null }): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/tasks`, req);
  }

  completeTask(taskId: number): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/admin/legal/tasks/${taskId}/complete`, {});
  }

  addCorrespondence(id: number, req: { direction: string; channel: string | null; summary: string }): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/correspondence`, req);
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

  enable(code: string): Observable<MfaEnableResult> {
    return this.http.post<MfaEnableResult>(`${this.base}/enable`, { code });
  }

  regenerateBackupCodes(): Observable<BackupCodes> {
    return this.http.post<BackupCodes>(`${this.base}/backup-codes`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class SecurityApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin/security`;

  overview(): Observable<SecurityOverview> {
    return this.http.get<SecurityOverview>(`${this.base}/overview`);
  }

  sessions(): Observable<{ sessions: ActiveSessionRow[] }> {
    return this.http.get<{ sessions: ActiveSessionRow[] }>(`${this.base}/sessions`);
  }
}

