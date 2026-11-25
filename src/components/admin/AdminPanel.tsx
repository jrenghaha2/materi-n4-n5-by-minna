import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  GraduationCap,
  Loader2,
  Lock,
  Radio,
  Search,
  Shield,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  ActivityEventDoc,
  ActivityEventType,
  AdminMonitoredUserRow,
  AdminSortOption,
  PresenceStatus,
  UserDetailReport,
  UserRole,
} from '../../types/bunpou';
import type { AdminKpiSummary } from '../../utils/rbac';
import {
  canModifyTargetRole,
  filterAndSortMonitoredUsers,
  formatRelativeTimeId,
  getRoleLabel,
} from '../../utils/rbac';
import { LiveQuizInlineCard } from './LiveQuizInlineCard';
import { LiveQuizMonitorModal } from './LiveQuizMonitorModal';
import { UserDetailModal } from './UserDetailModal';

type AdminSubTab = 'realtime' | 'events' | 'users';

interface AdminPanelProps {
  actorUid: string;
  actorRole: UserRole;
  isSuperAdmin: boolean;
  rows: AdminMonitoredUserRow[];
  events: ActivityEventDoc[];
  kpis: AdminKpiSummary;
  nowMs: number;
  loading: boolean;
  hydratingLegacy: boolean;
  hydrationProgress: { done: number; total: number };
  updatingRoleUid: string | null;
  showFurigana: boolean;
  onChangeUserRole: (target: AdminMonitoredUserRow, nextRole: UserRole) => Promise<boolean>;
  onSubscribeUserDetail: (
    uid: string,
    onUpdate: (detail: UserDetailReport) => void
  ) => () => void;
}

const SORT_OPTIONS: { value: AdminSortOption; label: string }[] = [
  { value: 'latest', label: 'Waktu Terbaru' },
  { value: 'name_asc', label: 'Abjad (A–Z)' },
  { value: 'name_desc', label: 'Abjad (Z–A)' },
  { value: 'progress_desc', label: 'Hafalan / Progres Terbanyak' },
  { value: 'quiz_desc', label: 'Tes / Kuis Terbanyak' },
];

function PresenceLabel({ presence }: { presence: PresenceStatus }) {
  if (presence === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
        Online
      </span>
    );
  }
  if (presence === 'recent') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
        Baru aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" aria-hidden="true" />
      Offline
    </span>
  );
}

function RoleText({ role, isBootstrap }: { role: UserRole; isBootstrap: boolean }) {
  if (role === 'superadmin') {
    return (
      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
        {isBootstrap ? 'Superadmin Utama' : 'Superadmin'}
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">
        Admin (Pantau)
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
      Pembelajar
    </span>
  );
}

function EventTypeLabel({ type }: { type: ActivityEventType }) {
  if (type === 'quiz_completed') {
    return (
      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        Selesai Kuis
      </span>
    );
  }
  if (type === 'quiz_started') {
    return (
      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
        Mulai Kuis
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">
      Pencapaian Progres
    </span>
  );
}

export function AdminPanel({
  actorUid,
  actorRole,
  isSuperAdmin,
  rows,
  events,
  kpis,
  nowMs,
  loading,
  hydratingLegacy,
  hydrationProgress,
  updatingRoleUid,
  showFurigana,
  onChangeUserRole,
  onSubscribeUserDetail,
}: AdminPanelProps) {
  const [subTab, setSubTab] = useState<AdminSubTab>('realtime');

  // Shared Search, Filter & Sort state for Tab 1 (Realtime)
  const [realtimeSearch, setRealtimeSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | PresenceStatus | 'quizzing'>('all');
  const [realtimeSort, setRealtimeSort] = useState<AdminSortOption>('latest');

  // Event Feed state for Tab 2
  const [eventSearch, setEventSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | ActivityEventType>('all');

  // User / Role Management state for Tab 3
  const [usersSearch, setUsersSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [usersSort, setUsersSort] = useState<AdminSortOption>('latest');
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});

  // Real-time Detail Modal, Inline Live Quiz expansion & Answer Key toggle (OFF by default)
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);
  const [liveQuizMonitorUid, setLiveQuizMonitorUid] = useState<string | null>(null);
  const [collapsedQuizUids, setCollapsedQuizUids] = useState<Record<string, boolean>>({});
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [detailReport, setDetailReport] = useState<UserDetailReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggleInlineLiveQuiz = (uid: string) => {
    setCollapsedQuizUids(prev => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const presenceCounts = useMemo(() => {
    let online = 0;
    let recent = 0;
    let quizzing = 0;
    let offline = 0;
    for (const r of rows) {
      if (r.presence === 'online') online += 1;
      else if (r.presence === 'recent') recent += 1;
      else offline += 1;
      if (r.quizInProgress) quizzing += 1;
    }
    return {
      all: rows.length,
      online,
      recent,
      quizzing,
      offline,
    };
  }, [rows]);

  const selectedUser = useMemo(
    () => (selectedUserUid ? rows.find(r => r.uid === selectedUserUid) ?? null : null),
    [rows, selectedUserUid]
  );

  const liveQuizUser = useMemo(
    () => (liveQuizMonitorUid ? rows.find(r => r.uid === liveQuizMonitorUid) ?? null : null),
    [rows, liveQuizMonitorUid]
  );

  useEffect(() => {
    if (!selectedUserUid) {
      setDetailReport(null);
      setDetailLoading(false);
      return;
    }

    setDetailReport(null);
    setDetailLoading(true);

    const unsubscribe = onSubscribeUserDetail(selectedUserUid, report => {
      setDetailReport(report);
      setDetailLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedUserUid, onSubscribeUserDetail]);

  const realtimeRows = useMemo(
    () =>
      filterAndSortMonitoredUsers(rows, {
        search: realtimeSearch,
        presenceFilter,
        sortBy: realtimeSort,
      }),
    [rows, realtimeSearch, presenceFilter, realtimeSort]
  );

  const userManagementRows = useMemo(
    () =>
      filterAndSortMonitoredUsers(rows, {
        search: usersSearch,
        roleFilter,
        sortBy: usersSort,
      }),
    [rows, usersSearch, roleFilter, usersSort]
  );

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter(ev => {
      if (eventTypeFilter !== 'all' && ev.type !== eventTypeFilter) return false;
      if (q) {
        const hay = `${ev.displayName} ${ev.email} ${ev.title} ${ev.detail}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, eventSearch, eventTypeFilter]);

  const handleOpenDetail = (row: AdminMonitoredUserRow) => {
    setSelectedUserUid(row.uid);
  };

  const handleConfirmRole = async (row: AdminMonitoredUserRow) => {
    const pendingRole = draftRoles[row.uid];
    if (!pendingRole || pendingRole === row.role) return;
    const ok = await onChangeUserRole(row, pendingRole);
    if (ok) {
      setDraftRoles(prev => {
        const next = { ...prev };
        delete next[row.uid];
        return next;
      });
    }
  };

  const handleCancelDraftRole = (uid: string) => {
    setDraftRoles(prev => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const isDemotionToUser = (currentRole: UserRole, nextRole: UserRole) =>
    (currentRole === 'admin' || currentRole === 'superadmin') && nextRole === 'user';

  return (
    <section
      aria-label={isSuperAdmin ? 'Panel Superadmin' : 'Panel Admin'}
      className="space-y-5"
    >
      {/* Panel Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {isSuperAdmin ? (
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
            ) : (
              <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
            )}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              {isSuperAdmin ? 'Panel Superadmin' : 'Panel Admin'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pemantauan aktivitas belajar &amp; hasil kuis real-time ·{' '}
            {isSuperAdmin
              ? 'Akses penuh manajemen peran 3 tingkat'
              : 'Mode pemantauan baca saja (read-only)'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {hydratingLegacy ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300 tabular-nums">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              Memuat data lama ({hydrationProgress.done}/{hydrationProgress.total})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Sinkronisasi langsung aktif
            </span>
          )}
        </div>
      </div>

      {/* 4 Real-Time KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sedang Online</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
            {kpis.onlineCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Aktif dalam 2 menit terakhir
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sedang Mengerjakan Kuis
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-300 mt-1.5">
            {kpis.quizzingCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sesi tes aktif saat ini
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Pengguna Terdaftar
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50 mt-1.5">
            {kpis.totalUsers}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Akun terverifikasi di Firestore
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Sesi Tes / Kuis
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50 mt-1.5">
            {kpis.totalQuizSessions}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Akumulasi live &amp; riwayat lama
          </p>
        </div>
      </div>

      {/* 3 Sub-Tabs Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Sub-Tab Bar */}
        <div
          role="tablist"
          aria-label="Tab pemantauan admin"
          className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            id="admin-tab-realtime"
            aria-selected={subTab === 'realtime'}
            onClick={() => setSubTab('realtime')}
            className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'realtime'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Aktivitas Real-Time</span>
            <span className="font-mono tabular-nums text-xs opacity-75">({rows.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="admin-tab-events"
            aria-selected={subTab === 'events'}
            onClick={() => setSubTab('events')}
            className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'events'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Feed Kejadian</span>
            <span className="font-mono tabular-nums text-xs opacity-75">({events.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="admin-tab-users"
            aria-selected={subTab === 'users'}
            onClick={() => setSubTab('users')}
            className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'users'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isSuperAdmin ? 'Kelola Role' : 'Daftar Pengguna'}</span>
          </button>
        </div>

        {/* TAB 1: Aktivitas Real-Time */}
        {subTab === 'realtime' ? (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Status Filter Buttons with Live Counts (Semua / Online / Baru Aktif / Sedang Tes / Offline) */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'Semua', count: presenceCounts.all },
                  { id: 'online', label: 'Online', count: presenceCounts.online },
                  { id: 'recent', label: 'Baru Aktif', count: presenceCounts.recent },
                  { id: 'quizzing', label: 'Sedang Tes', count: presenceCounts.quizzing },
                  { id: 'offline', label: 'Offline', count: presenceCounts.offline },
                ] as const
              ).map(tab => {
                const active = presenceFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPresenceFilter(tab.id)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-slate-900 dark:border-indigo-500 bg-slate-900 dark:bg-indigo-600 text-white shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        active
                          ? 'text-white/85'
                          : tab.id === 'quizzing' && tab.count > 0
                          ? 'text-amber-600 dark:text-amber-400 font-bold'
                          : 'text-slate-400 dark:text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={realtimeSearch}
                  onChange={e => setRealtimeSearch(e.target.value)}
                  placeholder="Cari nama, email, atau modul..."
                  aria-label="Cari pengguna di aktivitas real-time"
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              <label className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <select
                  aria-label="Urutkan aktivitas real-time"
                  value={realtimeSort}
                  onChange={e => setRealtimeSort(e.target.value as AdminSortOption)}
                  className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="text-sm">Menghubungkan ke stream real-time Firestore...</p>
              </div>
            ) : realtimeRows.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400">
                Tidak ada pengguna yang cocok dengan filter pencarian saat ini.
              </div>
            ) : (
              <div className="space-y-3">
                {realtimeRows.map(row => {
                  const initial = row.displayName.trim().charAt(0).toUpperCase() || 'U';
                  const quizPct =
                    row.quizTotalQuestions > 0
                      ? Math.min(
                          100,
                          Math.round((row.quizCurrentQuestion / row.quizTotalQuestions) * 100)
                        )
                      : 0;
                  const isLiveQuizExpanded = row.quizInProgress && !collapsedQuizUids[row.uid];

                  return (
                    <div
                      key={row.uid}
                      className={`rounded-2xl border p-4 bg-white dark:bg-slate-900 transition-colors space-y-4 ${
                        row.quizInProgress
                          ? 'border-slate-200 dark:border-slate-800 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Top Row: User Info + Metrics + Actions */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* User identity + Presence + Active module + Quiz bar */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {row.avatarUrl ? (
                            <img
                              src={row.avatarUrl}
                              alt={row.displayName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0 mt-0.5"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 font-bold text-sm inline-flex items-center justify-center shrink-0 mt-0.5">
                              {initial}
                            </span>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                                {row.displayName}
                              </span>
                              <span
                                className="text-slate-300 dark:text-slate-700"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <PresenceLabel presence={row.presence} />
                              <span
                                className="text-slate-300 dark:text-slate-700"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {formatRelativeTimeId(row.lastActiveMs, nowMs)}
                              </span>
                              <span
                                className="text-slate-300 dark:text-slate-700"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <RoleText role={row.role} isBootstrap={row.isBootstrapSuperAdmin} />
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {row.email || 'Email belum tercatat'} ·{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {row.moduleLabel}
                              </span>
                            </p>

                            {/* Live Quiz Progress Bar if currently taking a quiz */}
                            {row.quizInProgress ? (
                              <div className="pt-1.5 max-w-md space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                                  <span className="font-bold text-amber-700 dark:text-amber-400">
                                    Sedang Mengerjakan Tes: Soal {row.quizCurrentQuestion}/
                                    {row.quizTotalQuestions}
                                  </span>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    {row.quizCorrectCount} benar
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                                    style={{ width: `${Math.max(quizPct, 6)}%` }}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Progress & Quiz Metrics + Expand Live Quiz & Detail buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 shrink-0">
                          <div className="flex items-center gap-5 text-xs tabular-nums">
                            <div className="text-right">
                              <p className="text-slate-500 dark:text-slate-400">Hafalan</p>
                              <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                                {row.totalMastered}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {row.totalMasteredBunpou}B / {row.totalMasteredKotoba}K
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-slate-500 dark:text-slate-400">Sesi Tes</p>
                              <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                                {row.totalQuizSessions}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-slate-500 dark:text-slate-400">Skor Akhir</p>
                              <p
                                className={`text-sm font-bold font-mono ${
                                  row.lastQuizScore >= 80
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : row.lastQuizScore >= 60
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : row.lastQuizScore >= 0
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {row.lastQuizScore >= 0 ? `${row.lastQuizScore}%` : '—'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {row.quizInProgress ? (
                              <button
                                type="button"
                                aria-expanded={isLiveQuizExpanded}
                                onClick={() => toggleInlineLiveQuiz(row.uid)}
                                className="min-h-[38px] px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                              >
                                <Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>{isLiveQuizExpanded ? 'Tutup Soal' : 'Lihat Soal'}</span>
                                {isLiveQuizExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                )}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(row)}
                              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Detail</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Expandable Live Quiz Question Monitor directly beneath user row */}
                      {isLiveQuizExpanded ? (
                        <LiveQuizInlineCard
                          userRow={row}
                          showFurigana={showFurigana}
                          showAnswerKey={showAnswerKey}
                          onToggleAnswerKey={() => setShowAnswerKey(v => !v)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* TAB 2: Feed Kejadian */}
        {subTab === 'events' ? (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  placeholder="Cari nama pengguna atau kejadian..."
                  aria-label="Cari feed kejadian"
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto shrink-0">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'quiz_completed', label: 'Selesai Kuis' },
                    { id: 'quiz_started', label: 'Mulai Kuis' },
                    { id: 'progress_milestone', label: 'Progres' },
                  ] as const
                ).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEventTypeFilter(item.id)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      eventTypeFilter === item.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400">
                Belum ada kejadian yang cocok. Kejadian baru akan muncul otomatis saat pengguna mulai kuis, menyelesaikan kuis, atau mencapai milestone hafalan.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {filteredEvents.map(ev => {
                  const timeStr = ev.createdAtMs
                    ? new Date(ev.createdAtMs).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  return (
                    <div
                      key={ev.id}
                      className="px-4 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <EventTypeLabel type={ev.type} />
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {ev.displayName}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            ({ev.bookId.toUpperCase()})
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {ev.title}
                        </p>
                        {ev.detail ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ev.detail}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 sm:text-right">
                        {ev.type === 'quiz_completed' && ev.score >= 0 ? (
                          <span
                            className={`text-sm font-bold font-mono tabular-nums ${
                              ev.score >= 80
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : ev.score >= 60
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {ev.score}%
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
                          {formatRelativeTimeId(ev.createdAtMs, nowMs)}
                          {timeStr ? ` · ${timeStr}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* TAB 3: Kelola Role (Superadmin) / Daftar Pengguna (Admin) */}
        {subTab === 'users' ? (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  placeholder="Cari nama atau email pengguna..."
                  aria-label="Cari daftar pengguna"
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="Filter berdasarkan peran"
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value as 'all' | UserRole)}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                >
                  <option value="all">Semua Peran</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="admin">Admin (Pantau)</option>
                  <option value="user">Pembelajar</option>
                </select>

                <label className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <select
                    aria-label="Urutkan daftar pengguna"
                    value={usersSort}
                    onChange={e => setUsersSort(e.target.value as AdminSortOption)}
                    className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {userManagementRows.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400">
                Tidak ada pengguna yang cocok dengan pencarian atau filter peran.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {userManagementRows.map(row => {
                  const initial = row.displayName.trim().charAt(0).toUpperCase() || 'U';
                  const isSelf = row.uid === actorUid;
                  const roleGuard = canModifyTargetRole(actorUid, actorRole, row);
                  const selectedDraft = draftRoles[row.uid] ?? row.role;
                  const hasPendingChange = selectedDraft !== row.role;
                  const busy = updatingRoleUid === row.uid;
                  const demoting = isDemotionToUser(row.role, selectedDraft);

                  return (
                    <div
                      key={row.uid}
                      className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-3.5"
                    >
                      {/* User Info + Inline Summary */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {row.avatarUrl ? (
                          <img
                            src={row.avatarUrl}
                            alt={row.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0 mt-0.5"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 font-bold text-xs inline-flex items-center justify-center shrink-0 mt-0.5">
                            {initial}
                          </span>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                              {row.displayName}
                            </span>
                            {isSelf ? (
                              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                (Akun Anda)
                              </span>
                            ) : null}
                            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                              ·
                            </span>
                            <RoleText role={row.role} isBootstrap={row.isBootstrapSuperAdmin} />
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {row.email || 'Email belum tercatat (akan dilengkapi saat login)'}
                          </p>

                          <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                            Hafalan:{' '}
                            <strong className="font-mono text-slate-900 dark:text-slate-100">
                              {row.totalMastered}
                            </strong>{' '}
                            ({row.totalMasteredBunpou} Bunpou, {row.totalMasteredKotoba} Kotoba) ·
                            Kuis:{' '}
                            <strong className="font-mono text-slate-900 dark:text-slate-100">
                              {row.totalQuizSessions}
                            </strong>{' '}
                            sesi
                            {row.lastQuizScore >= 0 ? (
                              <>
                                {' '}
                                · Skor terakhir:{' '}
                                <strong className="font-mono text-indigo-700 dark:text-indigo-300">
                                  {row.lastQuizScore}%
                                </strong>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {/* Role Controls (Superadmin only) + Detail Button */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isSuperAdmin ? (
                          roleGuard.allowed ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                aria-label={`Ubah peran untuk ${row.displayName}`}
                                value={selectedDraft}
                                disabled={busy}
                                onChange={e =>
                                  setDraftRoles(prev => ({
                                    ...prev,
                                    [row.uid]: e.target.value as UserRole,
                                  }))
                                }
                                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer disabled:opacity-50"
                              >
                                <option value="user">{getRoleLabel('user')}</option>
                                <option value="admin">{getRoleLabel('admin')}</option>
                                <option value="superadmin">{getRoleLabel('superadmin')}</option>
                              </select>

                              {hasPendingChange ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleConfirmRole(row)}
                                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                                      demoting
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                  >
                                    {busy ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                    )}
                                    <span>{demoting ? 'Cabut Akses' : 'Simpan'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleCancelDraftRole(row.uid)}
                                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Batal</span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 whitespace-nowrap">
                              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                {row.isBootstrapSuperAdmin
                                  ? 'Superadmin Utama · Terkunci'
                                  : 'Akun Anda · Terkunci'}
                              </span>
                            </span>
                          )
                        ) : null}

                        {row.quizInProgress ? (
                          <button
                            type="button"
                            onClick={() => setLiveQuizMonitorUid(row.uid)}
                            className="min-h-[38px] px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Soal Live</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void handleOpenDetail(row)}
                          className="min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Detail</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Full Progress & Quiz Detail Modal (100% Real-Time) */}
      <UserDetailModal
        open={Boolean(selectedUser)}
        userRow={selectedUser}
        detail={detailReport}
        loading={detailLoading}
        nowMs={nowMs}
        showFurigana={showFurigana}
        onOpenLiveQuiz={row => {
          setSelectedUserUid(null);
          setDetailReport(null);
          setLiveQuizMonitorUid(row.uid);
        }}
        onClose={() => {
          setSelectedUserUid(null);
          setDetailReport(null);
        }}
      />

      {/* Real-Time Live Quiz Question & Answer Inspector Modal */}
      <LiveQuizMonitorModal
        open={Boolean(liveQuizUser)}
        userRow={liveQuizUser}
        nowMs={nowMs}
        showFurigana={showFurigana}
        showAnswerKey={showAnswerKey}
        onToggleAnswerKey={() => setShowAnswerKey(v => !v)}
        onOpenFullDetail={row => handleOpenDetail(row)}
        onClose={() => setLiveQuizMonitorUid(null)}
      />
    </section>
  );
}
