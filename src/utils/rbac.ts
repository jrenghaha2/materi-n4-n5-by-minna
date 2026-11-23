import type {
  AdminMonitoredUserRow,
  AdminSortOption,
  AdminUserRecord,
  HydratedUserStats,
  LiveActivityDoc,
  PresenceStatus,
  UserRole,
} from '../types/bunpou';

export const BOOTSTRAP_SUPERADMIN_EMAIL = 'jrenghaha2@gmail.com';

export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
export const RECENT_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export const VALID_USER_ROLES: readonly UserRole[] = ['user', 'admin', 'superadmin'] as const;

export function normalizeEmail(email?: string | null): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 120);
}

export function isBootstrapSuperAdminEmail(email?: string | null): boolean {
  return normalizeEmail(email) === BOOTSTRAP_SUPERADMIN_EMAIL;
}

export function sanitizeUserRole(raw: unknown): UserRole {
  if (raw === 'superadmin' || raw === 'admin' || raw === 'user') {
    return raw;
  }
  return 'user';
}

export function resolveEffectiveRole(
  storedRole: unknown,
  email?: string | null,
  emailVerified = false
): UserRole {
  if (emailVerified && isBootstrapSuperAdminEmail(email)) {
    return 'superadmin';
  }
  return sanitizeUserRole(storedRole);
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === 'superadmin';
}

export function isAdminOrAboveRole(role: UserRole): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function getRoleLabel(role: UserRole): string {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin (Pantau)';
  return 'Pembelajar';
}

export function canModifyTargetRole(
  actorUid: string,
  actorRole: UserRole,
  target: { uid: string; email?: string | null; role: UserRole }
): { allowed: boolean; reason?: string } {
  if (actorRole !== 'superadmin') {
    return { allowed: false, reason: 'Hanya Superadmin yang dapat mengubah peran pengguna.' };
  }
  if (target.uid === actorUid) {
    return { allowed: false, reason: 'Anda tidak dapat mengubah peran akun Anda sendiri.' };
  }
  if (isBootstrapSuperAdminEmail(target.email)) {
    return {
      allowed: false,
      reason: 'Superadmin Utama dilindungi secara permanen dan tidak dapat diubah.',
    };
  }
  return { allowed: true };
}

export function getPresenceStatus(
  updatedAtMs: number | null,
  nowMs: number = Date.now()
): PresenceStatus {
  if (!updatedAtMs || !Number.isFinite(updatedAtMs)) return 'offline';
  const diff = Math.max(0, nowMs - updatedAtMs);
  if (diff <= ONLINE_THRESHOLD_MS) return 'online';
  if (diff <= RECENT_THRESHOLD_MS) return 'recent';
  return 'offline';
}

export function formatProgressPercent(
  mastered: number,
  total: number
): { label: string; barWidthPct: number } {
  if (total <= 0 || mastered <= 0) {
    return { label: '0%', barWidthPct: 0 };
  }
  const raw = Math.min(100, (mastered / total) * 100);
  if (raw < 1) {
    const rounded1 = Math.max(0.1, Math.round(raw * 10) / 10);
    return {
      label: `${rounded1.toFixed(1)}%`,
      barWidthPct: Math.max(raw, 1.5),
    };
  }
  return {
    label: `${Math.min(100, Math.round(raw))}%`,
    barWidthPct: raw,
  };
}

export function mergeUserMonitoringRow(
  user: AdminUserRecord,
  live: LiveActivityDoc | undefined,
  hydrated: HydratedUserStats | undefined,
  nowMs: number = Date.now()
): AdminMonitoredUserRow {
  const isBootstrap = isBootstrapSuperAdminEmail(user.email);
  const role: UserRole = isBootstrap ? 'superadmin' : user.role;

  const hasLive = Boolean(live);
  const totalMasteredBunpou = hasLive
    ? live!.totalMasteredBunpou
    : hydrated?.totalMasteredBunpou ?? 0;
  const totalMasteredKotoba = hasLive
    ? live!.totalMasteredKotoba
    : hydrated?.totalMasteredKotoba ?? 0;
  const totalMastered = totalMasteredBunpou + totalMasteredKotoba;
  const totalQuizSessions = hasLive
    ? live!.totalQuizSessions
    : hydrated?.totalQuizSessions ?? 0;

  const lastQuizScore =
    live && live.lastQuizScore >= 0
      ? live.lastQuizScore
      : hydrated && hydrated.lastQuizScore >= 0
      ? hydrated.lastQuizScore
      : -1;

  const lastQuizSummary =
    (live && live.lastQuizSummary) || (hydrated && hydrated.lastQuizSummary) || '';

  const currentStreak = hasLive
    ? live!.currentStreak
    : hydrated?.currentStreak ?? 0;

  const liveUpdatedAtMs = live?.updatedAtMs ?? null;
  const presence = getPresenceStatus(liveUpdatedAtMs, nowMs);
  const quizInProgress = Boolean(live?.quizInProgress && presence === 'online');

  const lastActiveMs =
    liveUpdatedAtMs ?? hydrated?.lastActivityMs ?? user.updatedAtMs ?? user.createdAtMs ?? null;

  return {
    uid: user.uid,
    displayName: user.displayName || live?.displayName || 'Pengguna',
    email: user.email || live?.email || '',
    avatarUrl: user.avatarUrl || live?.avatarUrl || '',
    role,
    isBootstrapSuperAdmin: isBootstrap,
    presence,
    status: quizInProgress ? 'quizzing' : presence === 'online' ? live?.status ?? 'browsing' : 'idle',
    moduleLabel: live?.moduleLabel || (hydrated ? 'Data Historis' : 'Belum ada aktivitas live'),
    quizInProgress,
    quizMode: quizInProgress ? live?.quizMode ?? '' : '',
    quizBookId: quizInProgress ? live?.quizBookId ?? '' : '',
    quizCurrentQuestion: quizInProgress ? live?.quizCurrentQuestion ?? 0 : 0,
    quizTotalQuestions: quizInProgress ? live?.quizTotalQuestions ?? 0 : 0,
    quizCorrectCount: quizInProgress ? live?.quizCorrectCount ?? 0 : 0,
    quizFromChapter: quizInProgress ? live?.quizFromChapter ?? 0 : 0,
    quizToChapter: quizInProgress ? live?.quizToChapter ?? 0 : 0,
    quizPatternId: quizInProgress ? live?.quizPatternId ?? '' : '',
    quizExampleIndex: quizInProgress ? live?.quizExampleIndex ?? 0 : 0,
    quizChoiceIds: quizInProgress ? live?.quizChoiceIds ?? [] : [],
    quizSelectedChoiceId: quizInProgress ? live?.quizSelectedChoiceId ?? '' : '',
    quizAnswerCorrect: quizInProgress ? live?.quizAnswerCorrect ?? -1 : -1,
    quizLiveAnswers: quizInProgress ? live?.quizLiveAnswers ?? [] : [],
    totalMasteredBunpou,
    totalMasteredKotoba,
    totalMastered,
    totalQuizSessions,
    lastQuizScore,
    lastQuizSummary,
    currentStreak,
    lastActiveMs,
    createdAtMs: user.createdAtMs,
    hasLiveActivity: Boolean(live),
    hydratedFromLegacy: Boolean(!live && hydrated),
  };
}

export interface AdminKpiSummary {
  onlineCount: number;
  quizzingCount: number;
  totalUsers: number;
  totalQuizSessions: number;
}

export function computeAdminKpis(rows: AdminMonitoredUserRow[]): AdminKpiSummary {
  let onlineCount = 0;
  let quizzingCount = 0;
  let totalQuizSessions = 0;

  for (const row of rows) {
    if (row.presence === 'online') onlineCount += 1;
    if (row.quizInProgress) quizzingCount += 1;
    totalQuizSessions += row.totalQuizSessions;
  }

  return {
    onlineCount,
    quizzingCount,
    totalUsers: rows.length,
    totalQuizSessions,
  };
}

export interface AdminFilterOptions {
  search?: string;
  roleFilter?: 'all' | UserRole;
  presenceFilter?: 'all' | PresenceStatus | 'quizzing';
  sortBy: AdminSortOption;
}

export function filterAndSortMonitoredUsers(
  rows: AdminMonitoredUserRow[],
  options: AdminFilterOptions
): AdminMonitoredUserRow[] {
  const query = (options.search ?? '').trim().toLowerCase();
  const roleFilter = options.roleFilter ?? 'all';
  const presenceFilter = options.presenceFilter ?? 'all';

  const filtered = rows.filter(row => {
    if (query) {
      const hay = `${row.displayName} ${row.email} ${row.moduleLabel}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (roleFilter !== 'all' && row.role !== roleFilter) return false;
    if (presenceFilter === 'quizzing') {
      if (!row.quizInProgress) return false;
    } else if (presenceFilter !== 'all' && row.presence !== presenceFilter) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered];
  const compareName = (a: AdminMonitoredUserRow, b: AdminMonitoredUserRow) =>
    a.displayName.localeCompare(b.displayName, 'id', { sensitivity: 'base' }) ||
    a.email.localeCompare(b.email, 'id', { sensitivity: 'base' }) ||
    a.uid.localeCompare(b.uid);

  sorted.sort((a, b) => {
    switch (options.sortBy) {
      case 'name_asc':
        return compareName(a, b);
      case 'name_desc':
        return compareName(b, a);
      case 'progress_desc':
        return (
          b.totalMastered - a.totalMastered ||
          b.totalQuizSessions - a.totalQuizSessions ||
          compareName(a, b)
        );
      case 'quiz_desc':
        return (
          b.totalQuizSessions - a.totalQuizSessions ||
          b.totalMastered - a.totalMastered ||
          compareName(a, b)
        );
      case 'latest':
      default: {
        const timeA = a.lastActiveMs ?? 0;
        const timeB = b.lastActiveMs ?? 0;
        return timeB - timeA || compareName(a, b);
      }
    }
  });

  return sorted;
}

export function formatRelativeTimeId(
  timestampMs: number | null,
  nowMs: number = Date.now()
): string {
  if (!timestampMs || !Number.isFinite(timestampMs)) return 'Belum tercatat';
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 30) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return new Date(timestampMs).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
