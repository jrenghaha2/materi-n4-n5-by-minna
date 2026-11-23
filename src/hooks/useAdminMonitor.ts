import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchUserFullDetail,
  hydrateUserSummaryStats,
  subscribeActivityEvents,
  subscribeAllUsers,
  subscribeLiveActivities,
  subscribeUserFullDetail,
  updateTargetUserRole,
} from '../services/adminMonitoringService';
import type {
  ActivityEventDoc,
  AdminMonitoredUserRow,
  AdminUserRecord,
  HydratedUserStats,
  LiveActivityDoc,
  UserDetailReport,
  UserRole,
} from '../types/bunpou';
import {
  canModifyTargetRole,
  computeAdminKpis,
  getRoleLabel,
  mergeUserMonitoringRow,
} from '../utils/rbac';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

const LEGACY_HYDRATION_BATCH_SIZE = 5;
const PRESENCE_TICK_MS = 30_000;

interface UseAdminMonitorOptions {
  enabled: boolean;
  actorUid: string | null;
  actorRole: UserRole;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

export function useAdminMonitor({
  enabled,
  actorUid,
  actorRole,
  showToast,
}: UseAdminMonitorOptions) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [liveMap, setLiveMap] = useState<Map<string, LiveActivityDoc>>(() => new Map());
  const [events, setEvents] = useState<ActivityEventDoc[]>([]);
  const [hydratedMap, setHydratedMap] = useState<Map<string, HydratedUserStats>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [hydratingLegacy, setHydratingLegacy] = useState(false);
  const [hydrationProgress, setHydrationProgress] = useState({ done: 0, total: 0 });
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const hydratedUidsRef = useRef<Set<string>>(new Set());
  const hydratingUidsRef = useRef<Set<string>>(new Set());

  // Refresh relative timestamps & online/recent/offline presence thresholds every 30s
  useEffect(() => {
    if (!enabled) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), PRESENCE_TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  // Attach real-time Firestore listeners only when authorized & panel is active
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let usersLoaded = false;
    let liveLoaded = false;
    const markReady = () => {
      if (usersLoaded && liveLoaded) setLoading(false);
    };

    const handleStreamError = (error: unknown) => {
      setLoading(false);
      if (isFirestoreQuotaError(error)) {
        showToast('Kuota Firestore tercapai saat memuat pemantauan real-time.', 'error', {
          actionLabel: 'Lihat Kuota',
          actionHref: getFirestoreUpgradeUrl(),
        });
      }
    };

    const unsubUsers = subscribeAllUsers(list => {
      usersLoaded = true;
      setUsers(list);
      markReady();
    }, handleStreamError);

    const unsubLive = subscribeLiveActivities(map => {
      liveLoaded = true;
      setLiveMap(map);
      markReady();
    }, handleStreamError);

    const unsubEvents = subscribeActivityEvents(
      80,
      list => {
        setEvents(list);
      },
      handleStreamError
    );

    return () => {
      unsubUsers();
      unsubLive();
      unsubEvents();
    };
  }, [enabled, showToast]);

  // Non-blocking batch hydration (5 users per batch) for legacy users without liveActivity/{uid}
  useEffect(() => {
    if (!enabled || users.length === 0) return;

    const candidates = users.filter(
      u =>
        !liveMap.has(u.uid) &&
        !hydratedUidsRef.current.has(u.uid) &&
        !hydratingUidsRef.current.has(u.uid)
    );

    if (candidates.length === 0) return;

    let cancelled = false;
    setHydratingLegacy(true);
    setHydrationProgress({ done: 0, total: candidates.length });

    (async () => {
      let completed = 0;
      for (let i = 0; i < candidates.length; i += LEGACY_HYDRATION_BATCH_SIZE) {
        if (cancelled) break;
        const batch = candidates.slice(i, i + LEGACY_HYDRATION_BATCH_SIZE);
        for (const u of batch) hydratingUidsRef.current.add(u.uid);

        const results = await Promise.allSettled(
          batch.map(u => hydrateUserSummaryStats(u.uid))
        );

        if (cancelled) break;

        setHydratedMap(prev => {
          const next = new Map(prev);
          results.forEach((res, idx) => {
            const uid = batch[idx].uid;
            hydratingUidsRef.current.delete(uid);
            hydratedUidsRef.current.add(uid);
            if (res.status === 'fulfilled') {
              next.set(uid, res.value);
            }
          });
          return next;
        });

        completed += batch.length;
        setHydrationProgress({ done: completed, total: candidates.length });
      }
      if (!cancelled) {
        setHydratingLegacy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, users, liveMap]);

  const rows: AdminMonitoredUserRow[] = useMemo(() => {
    return users.map(u =>
      mergeUserMonitoringRow(u, liveMap.get(u.uid), hydratedMap.get(u.uid), nowMs)
    );
  }, [users, liveMap, hydratedMap, nowMs]);

  const kpis = useMemo(() => computeAdminKpis(rows), [rows]);

  const changeUserRole = useCallback(
    async (target: AdminMonitoredUserRow, nextRole: UserRole): Promise<boolean> => {
      if (!actorUid) return false;
      const guard = canModifyTargetRole(actorUid, actorRole, target);
      if (!guard.allowed) {
        showToast(guard.reason || 'Aksi tidak diizinkan.', 'error');
        return false;
      }
      if (target.role === nextRole) return true;

      setUpdatingRoleUid(target.uid);
      try {
        await updateTargetUserRole(target.uid, nextRole);
        showToast(
          `Peran ${target.displayName} berhasil diubah menjadi ${getRoleLabel(nextRole)}.`,
          'success'
        );
        return true;
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Gagal mengubah peran: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else {
          showToast(
            'Gagal mengubah peran pengguna. Pastikan hak akses Superadmin Anda valid.',
            'error'
          );
        }
        return false;
      } finally {
        setUpdatingRoleUid(null);
      }
    },
    [actorUid, actorRole, showToast]
  );

  const loadUserDetail = useCallback(
    async (uid: string): Promise<UserDetailReport | null> => {
      try {
        const detail = await fetchUserFullDetail(uid);
        return detail;
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Gagal memuat detail: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else {
          showToast('Gagal memuat rincian progres pengguna.', 'error');
        }
        return null;
      }
    },
    [showToast]
  );

  const subscribeUserDetail = useCallback(
    (uid: string, onUpdate: (detail: UserDetailReport) => void) => {
      return subscribeUserFullDetail(uid, onUpdate, error => {
        if (isFirestoreQuotaError(error)) {
          showToast('Gagal memuat detail real-time: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      });
    },
    [showToast]
  );

  return {
    rows,
    events,
    kpis,
    nowMs,
    loading,
    hydratingLegacy,
    hydrationProgress,
    updatingRoleUid,
    changeUserRole,
    loadUserDetail,
    subscribeUserDetail,
  };
}
