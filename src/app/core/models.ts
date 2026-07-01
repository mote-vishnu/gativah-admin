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
  maxSeverity: 'HIGH' | 'MED' | 'LOW' | null;
  reporterCount: number;
  openReportsOnAuthor: number;
}

export interface ReportDetail extends ReportSummary {
  details: string;
  authorDisplayName: string | null;
  authorPhotoUrl: string | null;
  authorStatus: string;
  privacy: string | null;
  mediaCount: number;
  reviewedBy: number | null;
  reviewedAt: string | null;
}

export type ResolveAction = 'DISMISS' | 'TAKEDOWN' | 'WARN' | 'SUSPEND' | 'BAN' | 'REGION_BAN';

export interface ResolveRequest {
  action: ResolveAction;
  reason?: string;
  suspendDays?: number;
  country?: string;
}

export interface AutoFlagSignal {
  key: string;
  label: string;
  score: number | null;
  isBoolean: boolean;
  boolValue: boolean | null;
  severity: 'LOW' | 'MED' | 'HIGH';
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

export interface ReasonCount {
  reason: string;
  count: number;
}

export interface ReportStats {
  open: number;
  pending: number;
  reviewing: number;
  slaBreaches: number;
  resolved24h: number;
  repeatOffenders: number;
}

export interface AuthorSanctionRow {
  type: string;
  reason: string | null;
  suspendedUntil: string | null;
  createdAt: string | null;
}

export interface AuthorHistory {
  authorUserId: number | null;
  accountStatus: string | null;
  reportsAgainst: number;
  openReports: number;
  followers: number;
  plan: string;
  memberSince: string | null;
  recentSanctions: AuthorSanctionRow[];
}

export interface RegionBanRow {
  id: number;
  postId: number | null;
  country: string;
  reason: string | null;
  bannedByAdminId: number | null;
  bannedAt: string | null;
  lifted: boolean;
  authorUsername: string | null;
  snippet: string | null;
}

export interface AppealRow {
  id: number;
  subjectUserId: number;
  subjectUsername: string | null;
  relatedReportId: number | null;
  relatedActionId: number | null;
  originalAction: string | null;
  message: string;
  status: string;
  createdAt: string;
}

export interface AppealResolveRequest {
  grant: boolean;
  note?: string;
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
  newSubs30d: number;
  churnRate: number;
  grossTrendPct: number | null;
  mrr: number;
  arr: number;
  grossMtd: number;
  refundsMtd: number;
  netMtd: number;
}

export interface MrrMovement { start: number; added: number; churned: number; end: number; }

export interface PayoutRow {
  platform: string;
  gross: number;
  refunds: number;
  netGross: number;
  txnCount: number;
  commissionRate: number;
  commission: number;
  payout: number;
}
export interface PayoutsResponse {
  windowDays: number;
  platforms: PayoutRow[];
  grossTotal: number;
  refundTotal: number;
  netGrossTotal: number;
  commissionTotal: number;
  payoutTotal: number;
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

export interface TxnEventRow {
  id: number;
  platform: string;
  eventType: string;
  subtype: string | null;
  status: string;
  receivedAt: string | null;
  processedAt: string | null;
}

export interface TransactionDetail {
  id: number;
  userId: number | null;
  subscriptionId: number | null;
  planCode: string;
  platform: string;
  productId: string | null;
  storeTransactionId: string | null;
  originalTransactionId: string | null;
  type: string;
  status: string;
  grossAmount: number;
  grossCurrency: string;
  countryCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  purchasedAt: string | null;
  environment: string | null;
  source: string | null;
  notificationUuid: string | null;
  createdAt: string | null;
  subscription: SubscriptionRow | null;
  relatedTxns: TransactionRow[];
  events: TxnEventRow[];
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

export interface AuditStats {
  total: number;
  today: number;
  last7d: number;
  operators: number;
}

export interface UnenrolledAdmin { id: number; name: string; email: string; }
export interface SecurityOverview {
  mfaEnrolled: number;
  mfaTotal: number;
  activeAdmins: number;
  activeSessions: number;
  signIns7d: number;
  unenrolled: UnenrolledAdmin[];
}
export interface ActiveSessionRow {
  sessionId: number;
  adminUserId: number;
  adminName: string | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
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

export interface SessionRow {
  id: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
  revoked: boolean;
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
  approvalStatus: string;
  receivedAt: string;
  dueAt: string | null;
  overdue: boolean;
  disclosureCount: number;
}

export interface LegalStats {
  openRequests: number;
  underReview: number;
  pendingApproval: number;
  overdue: number;
  actioned30d: number;
  disclosures30d: number;
  openTasks: number;
}

export interface LegalTaskListRow {
  id: number;
  requestId: number;
  reference: string;
  requestType: string;
  title: string;
  status: string;
  assigneeAdminId: number | null;
  dueAt: string | null;
  createdAt: string;
  overdue: boolean;
}

export interface DisclosureRegisterRow {
  id: number;
  requestId: number;
  reference: string;
  requestType: string;
  disclosedBy: number | null;
  recipient: string;
  dataCategories: string;
  justification: string;
  disclosedAt: string;
}

export interface DisclosureRow {
  id: number;
  disclosedBy: number;
  recipient: string;
  dataCategories: string;
  justification: string;
  disclosedAt: string;
}

export interface LegalTaskRow {
  id: number;
  title: string;
  status: string;
  assigneeAdminId: number | null;
  dueAt: string | null;
  createdBy: number;
  createdAt: string | null;
  completedAt: string | null;
}

export interface LegalCorrespondenceRow {
  id: number;
  direction: string;
  channel: string | null;
  summary: string;
  createdBy: number;
  createdAt: string | null;
}

export interface LegalCustodyEventRow {
  id: number;
  event: string;
  detail: string | null;
  actorAdminId: number | null;
  createdAt: string | null;
}

export interface LegalRequestDetail extends LegalRequestSummary {
  scope: string | null;
  notes: string | null;
  approvalStatus: string;
  approvedBy: number | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  disclosures: DisclosureRow[];
  tasks: LegalTaskRow[];
  correspondence: LegalCorrespondenceRow[];
  custody: LegalCustodyEventRow[];
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
  photoUrl: string | null;
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

export interface UserDeviceRow {
  platform: string;
  appVersion: string | null;
  locale: string | null;
  lastSeenAt: string | null;
}

export interface ActivityPoint {
  date: string;
  steps: number;
  activeMinutes: number;
}

export interface UserInsights {
  reportsAgainst: number;
  sanctionCount: number;
  followers: number;
  following: number;
  posts: number;
  riskScore: number;
  riskLevel: string;
  devices: UserDeviceRow[];
  activity: ActivityPoint[];
}

export interface UserContentRow {
  type: string;
  id: number;
  snippet: string | null;
  kind: string | null;
  createdAt: string;
  removed: boolean;
  views: number;
  openReports: number;
}

export interface UserContentResponse {
  items: UserContentRow[];
}

export interface UserTxnRow {
  id: number;
  type: string;
  status: string;
  amount: number | null;
  currency: string | null;
  platform: string | null;
  purchasedAt: string | null;
}

export interface UserBilling {
  lifetimeValue: number;
  currency: string;
  refunds: number;
  transactions: number;
  items: UserTxnRow[];
}

export interface UserReportRow {
  reportId: number;
  contentType: string;
  contentId: number;
  snippet: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export interface UserReportsResponse {
  items: UserReportRow[];
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
  activityType: string | null;
  openReports: number;
  totalReports: number;
}

export interface ContentStats {
  posts: number;
  comments: number;
  stories: number;
  removed: number;
  flagged: number;
}

export interface ContentReportRef {
  reportId: number;
  reason: string;
  reporterUserId: number | null;
  reporterUsername: string | null;
  status: string;
  createdAt: string;
}

export interface ReactionCount { type: string; count: number; }
export interface MediaItem { mediaType: string; url: string | null; thumbnailUrl: string | null; }
export interface ContentCommentRow {
  id: number;
  authorUserId: number | null;
  authorUsername: string | null;
  content: string | null;
  createdAt: string | null;
  removed: boolean;
}
export interface GeoPoint { lat: number; lng: number; }
export interface ActivityShare {
  activityType: string;
  distanceKm: number | null;
  durationSecs: number | null;
  paceMinPerKm: number | null;
  caloriesBurned: number | null;
  route: GeoPoint[];
}

export interface ContentDetail {
  type: string;
  id: number;
  authorUserId: number | null;
  authorUsername: string | null;
  content: string | null;
  createdAt: string | null;
  removed: boolean;
  kind: string | null;
  privacy: string | null;
  viewCount: number;
  parentPostId: number | null;
  parentSnippet: string | null;
  reactionTotal: number;
  reactions: ReactionCount[];
  media: MediaItem[];
  commentCount: number;
  comments: ContentCommentRow[];
  activity: ActivityShare | null;
}

export interface TakedownContentRequest {
  reason: string;
}

export interface StoryRow {
  id: number;
  authorUserId: number | null;
  authorUsername: string | null;
  kind: string;
  snippet: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  reactionCount: number;
  removed: boolean;
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

export interface RsvpRow {
  userId: number | null;
  username: string | null;
  status: string;
  respondedAt: string | null;
}

export interface RoutePoint { seqNo: number; lat: number; lng: number; }

export interface ClubReportedContent {
  contentType: string;
  contentId: number;
  snippet: string | null;
  authorUserId: number | null;
  authorUsername: string | null;
  openReports: number;
  totalReports: number;
  latestReportId: number | null;
  latestReportAt: string | null;
}

export interface ClubEventDetail {
  id: number;
  clubId: number | null;
  title: string;
  kind: string;
  description: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  distanceM: number | null;
  createdByUserId: number | null;
  createdByUsername: string | null;
  createdAt: string | null;
  removed: boolean;
  rsvpGoing: number;
  rsvpMaybe: number;
  rsvpDeclined: number;
  rsvps: RsvpRow[];
  route: RoutePoint[];
}

export interface ClubInsights {
  owners: number;
  admins: number;
  regularMembers: number;
  pendingMembers: number;
  upcomingEvents: number;
  pastEvents: number;
  totalRsvps: number;
  newMembers30d: number;
}

export interface ClubStats {
  totalClubs: number;
  activeClubs: number;
  removedClubs: number;
  privateClubs: number;
  totalMembers: number;
  avgMembers: number;
  newClubs30d: number;
  upcomingEvents: number;
  largestClubMembers: number;
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
  insights: ClubInsights;
  members: ClubMemberRow[];
  events: ClubEventRow[];
}

// ── Billing Ops ───────────────────────────────────────────────
export interface EntitlementRow {
  id: number;
  userId: number | null;
  username: string | null;
  code: string;
  name: string | null;
  active: boolean;
  source: string;
  expiresAt: string | null;
  updatedAt: string | null;
}

export interface RefundRow {
  id: number;
  userId: number | null;
  username: string | null;
  planCode: string;
  type: string;
  grossAmount: number;
  grossCurrency: string;
  countryCode: string;
  purchasedAt: string;
}

export interface EntitlementDef {
  code: string;
  name: string;
}

export interface GrantCompRequest {
  userId: number;
  code: string;
  expiresAt: string | null;
  reason: string | null;
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

// ── Analytics / Insights ─────────────────────────────────────────
export interface TimePoint {
  date: string;
  value: number;
}

export interface StickinessPoint {
  date: string;
  dau: number;
  mau: number;
  stickiness: number;
}

export interface OverviewKpis {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  activeUsers: number;
  activeUsersDelta: number;
  newSignups: number;
  newSignupsDelta: number;
  totalEvents: number;
  totalEventsDelta: number;
  avgEventsPerUser: number;
}

export interface ActiveUsersResponse {
  activeUsers: TimePoint[];
  newSignups: TimePoint[];
}

export interface EventBreakdownRow {
  name: string;
  count: number;
  uniqueUsers: number;
  pct: number;
}

export interface EventBreakdownResponse {
  total: number;
  events: EventBreakdownRow[];
}

export interface EngagementResponse {
  series: StickinessPoint[];
}

export interface PlatformRow {
  platform: string;
  events: number;
  users: number;
  pct: number;
}

export interface VersionRow {
  appVersion: string;
  events: number;
  users: number;
}

export interface PlatformResponse {
  platforms: PlatformRow[];
  versions: VersionRow[];
}

export interface FunnelStep {
  key: string;
  label: string;
  users: number;
  conversionFromPrev: number;
  conversionFromStart: number;
}

export interface FunnelResponse {
  steps: FunnelStep[];
}

export interface RetentionRow {
  cohortWeek: string;
  cohortSize: number;
  retained: (number | null)[];
  retainedPct: (number | null)[];
}

export interface RetentionResponse {
  weeks: number;
  cohorts: RetentionRow[];
}

export interface CountryStat {
  code: string;
  name: string;
  users: number;
  pct: number;
}

export interface GeoResponse {
  totalUsers: number;
  mappedUsers: number;
  countries: CountryStat[];
}
