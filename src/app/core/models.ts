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
  role: string;
  authorities: string[];
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
