/** Wire types mirroring gativah-admin-api DTOs. */

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AdminMe {
  id: number;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  token: string | null;
  expiresInMs: number | null;
  mfaRequired: boolean;
  user: AdminMe | null;
}

// ── Moderation ────────────────────────────────────────────────
export interface ReportSummary {
  id: number;
  contentType: string;
  contentId: number;
  reason: string;
  status: string;
  createdAt: string;
  reporterUserId: number;
  reporterUsername: string;
  authorUserId: number;
  authorUsername: string;
  snippet: string;
  assigneeAdminId: number | null;
}

export interface ReportDetail extends ReportSummary {
  details: string;
  authorStatus: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
}

export type ResolveAction = 'DISMISS' | 'TAKEDOWN' | 'WARN' | 'SUSPEND' | 'BAN';

export interface ResolveRequest {
  action: ResolveAction;
  reason?: string;
  suspendDays?: number;
}

export interface ResolveResponse {
  ok: boolean;
  status: string;
  message: string;
}

export interface BulkResolveRequest {
  ids: number[];
  action: ResolveAction;
  reason?: string;
}

export interface BulkResolveResponse {
  resolved: number;
  failed: number;
  failedIds: number[];
}

export interface AssignRequest {
  adminId: number | null;
}

export interface BulkAssignRequest {
  ids: number[];
  adminId: number | null;
}

export interface ModerationActionRow {
  id: number;
  reportId: number | null;
  adminUserId: number;
  targetType: string;
  targetId: number;
  action: string;
  reason: string | null;
  createdAt: string;
}

// ── Finance ───────────────────────────────────────────────────
export interface FinanceOverview {
  activeSubscribers: number;
  trialing: number;
  inGrace: number;
  canceled30d: number;
  mrr: number;
  arr: number;
  grossMtd: number;
  refundsMtd: number;
  netMtd: number;
}

export interface RevenuePoint { period: string; gross: number; refunds: number; }
export interface RevenueSlice { key: string; gross: number; count: number; }
export interface FinanceRevenueResponse {
  granularity: string;
  groupBy: string | null;
  series: RevenuePoint[];
  breakdown: RevenueSlice[];
}

export interface TransactionRow {
  id: number;
  userId: number;
  planCode: string;
  platform: string;
  type: string;
  status: string;
  grossAmount: number;
  grossCurrency: string;
  countryCode: string;
  source: string;
  purchasedAt: string;
}

export interface SubscriptionRow {
  id: number;
  userId: number;
  planCode: string;
  platform: string;
  state: string;
  autoRenew: boolean;
  trial: boolean;
  currentPeriodEnd: string | null;
}

export interface DeadLetterRow {
  id: number;
  platform: string;
  eventType: string;
  attempts: number;
  lastError: string;
  receivedAt: string;
}

export interface WebhookHealth {
  received24h: number;
  processed24h: number;
  failed24h: number;
  deadLetter: number;
  lastProcessedAt: string | null;
  recentDeadLetters: DeadLetterRow[];
}

// ── Audit ─────────────────────────────────────────────────────
export interface AuditEntryRow {
  id: number;
  adminUserId: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  ip: string | null;
  createdAt: string;
}

// ── Staff ─────────────────────────────────────────────────────
export interface StaffRow {
  id: number;
  email: string;
  name: string;
  roles: string[];
  status: string;
  mfaEnrolled: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface InviteStaffRequest {
  email: string;
  name: string;
  roleIds: number[];
  password: string;
}

export interface UpdateStaffRequest {
  status?: string;
}

export interface AssignRolesRequest {
  roleIds: number[];
}

// ── Roles & Permissions ───────────────────────────────────────
export interface RoleResponse {
  id: number;
  name: string;
  description: string | null;
  system: boolean;
  permissionIds: number[];
  permissions: string[];
  userCount: number;
}

export interface RolesResponse {
  roles: RoleResponse[];
}

export interface PermissionResponse {
  id: number;
  code: string;
  action: string;
  featureCode: string;
}

export interface FeaturePermissions {
  featureCode: string;
  label: string;
  sortOrder: number;
  permissions: PermissionResponse[];
}

export interface PermissionCatalogResponse {
  features: FeaturePermissions[];
}

export interface CreateRoleRequest {
  name: string;
  description: string | null;
  permissionIds: number[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  permissionIds?: number[];
}

// ── Legal & Disclosure ────────────────────────────────────────
export type LegalStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'ACTIONED' | 'REJECTED' | 'CLOSED';

export interface LegalRequestSummary {
  id: number;
  reference: string;
  requestType: string;
  requestingAuthority: string;
  subjectUserId: number | null;
  status: LegalStatus;
  receivedAt: string;
  dueAt: string | null;
  disclosureCount: number;
}

export interface DisclosureRow {
  id: number;
  disclosedBy: number;
  recipient: string;
  dataCategories: string;
  justification: string;
  disclosedAt: string;
}

export interface LegalRequestDetail extends LegalRequestSummary {
  scope: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  disclosures: DisclosureRow[];
}

export interface CreateLegalRequest {
  reference: string;
  requestType: string;
  requestingAuthority: string;
  subjectUserId: number | null;
  scope: string | null;
  dueAt: string | null;
  notes: string | null;
}

export interface UpdateLegalRequest {
  status?: LegalStatus;
  notes?: string | null;
}

export interface RecordDisclosureRequest {
  recipient: string;
  dataCategories: string;
  justification: string;
}

// ── Users 360 ─────────────────────────────────────────────────
export interface UserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  accountStatus: string;
  verified: boolean;
  subscriptionState: string | null;
  createdAt: string;
}

export interface SubscriptionInfo {
  planCode: string;
  platform: string;
  state: string;
  trial: boolean;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
}

export interface SanctionRow {
  id: number;
  type: string;
  reason: string | null;
  suspendedUntil: string | null;
  adminUserId: number;
  createdAt: string;
}

export interface UserDetail {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  verified: boolean;
  accountStatus: string;
  suspendedUntil: string | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  subscription: SubscriptionInfo | null;
  sanctions: SanctionRow[];
}

export interface SuspendUserRequest {
  reason: string;
  days: number | null;
}

export interface BanUserRequest {
  reason: string;
}

// ── Content ───────────────────────────────────────────────────
export interface ContentRow {
  id: number;
  type: string;
  authorUserId: number | null;
  authorUsername: string | null;
  snippet: string | null;
  createdAt: string;
  removed: boolean;
}

export interface TakedownContentRequest {
  reason: string;
}

// ── Clubs ─────────────────────────────────────────────────────
export interface ClubSummary {
  id: number;
  name: string;
  ownerUserId: number | null;
  ownerUsername: string | null;
  visibility: string;
  memberCount: number;
  eventCount: number;
  removed: boolean;
  createdAt: string;
}

export interface ClubMemberRow {
  userId: number | null;
  username: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
}

export interface ClubEventRow {
  id: number;
  title: string;
  kind: string;
  startsAt: string | null;
  rsvpCount: number;
  removed: boolean;
}

export interface ClubDetail {
  id: number;
  name: string;
  description: string | null;
  photoUrl: string | null;
  ownerUserId: number | null;
  ownerUsername: string | null;
  visibility: string;
  memberCount: number;
  removed: boolean;
  createdAt: string;
  members: ClubMemberRow[];
  events: ClubEventRow[];
}

// ── MFA ───────────────────────────────────────────────────────
export interface MfaStatus {
  enrolled: boolean;
}

export interface MfaStart {
  secret: string;
  otpauthUri: string;
  alreadyEnrolled: boolean;
}
