import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { DailyTrackerState } from '../types/bunpou';
import {
  fetchDailyTrackerDoc,
  saveDailyTrackerDoc,
  subscribeDailyTrackerDoc,
} from '../services/cloudSyncService';
import {
  areDailyTrackerStatesEqual,
  buildRecent7Days,
  calculateCurrentStreak,
  DAILY_GOAL_OPTIONS,
  formatLocalDateKey,
  loadDailyTrackerState,
  mergeDailyTrackerStates,
  recordMasteredToggleForDay,
  recordQuizSessionForDay,
  saveDailyTrackerState,
} from '../utils/dailyProgress';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

interface UseDailyTrackerOptions {
  user: User | null;
  isVerified: boolean;
  profileReady: boolean;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

export function useDailyTracker({
  user,
  isVerified,
  profileReady,
  showToast,
}: UseDailyTrackerOptions) {
  const [state, setState] = useState<DailyTrackerState>(() => loadDailyTrackerState());
  const [syncingDaily, setSyncingDaily] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const pendingWritesRef = useRef(0);

  const pushDailyToCloud = useCallback(
    async (uid: string, nextState: DailyTrackerState) => {
      pendingWritesRef.current += 1;
      try {
        await saveDailyTrackerDoc(uid, nextState);
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Target harian tersimpan lokal (kuota Firestore tercapai).', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [showToast]
  );

  // Real-time onSnapshot subscription for daily tracker & streak
  useEffect(() => {
    if (!user || !isVerified || !profileReady) return;

    const uid = user.uid;
    let initialized = false;
    let disposed = false;

    const unsub = subscribeDailyTrackerDoc(
      uid,
      remote => {
        if (disposed) return;

        const isFirst = !initialized;
        initialized = true;

        if (!isFirst && pendingWritesRef.current > 0) return;

        if (isFirst) {
          const merged = mergeDailyTrackerStates(stateRef.current, remote);
          saveDailyTrackerState(merged);
          stateRef.current = merged;
          setState(merged);

          if (!remote || !areDailyTrackerStatesEqual(merged, remote)) {
            void pushDailyToCloud(uid, merged);
          }
          return;
        }

        if (!remote) return;
        if (areDailyTrackerStatesEqual(stateRef.current, remote)) return;

        saveDailyTrackerState(remote);
        stateRef.current = remote;
        setState(remote);
      },
      error => {
        if (isFirestoreQuotaError(error)) {
          showToast('Kuota Firestore tercapai saat menyinkronkan target harian.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    );

    return () => {
      disposed = true;
      unsub();
    };
  }, [user, isVerified, profileReady, pushDailyToCloud, showToast]);

  const syncDailyWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingDaily(true);
      try {
        const remote = await fetchDailyTrackerDoc(user.uid);
        const merged = mergeDailyTrackerStates(stateRef.current, remote);
        saveDailyTrackerState(merged);
        stateRef.current = merged;
        setState(merged);

        if (!remote || !areDailyTrackerStatesEqual(merged, remote)) {
          await pushDailyToCloud(user.uid, merged);
        }

        if (!silent) {
          showToast('Target harian & streak berhasil disinkronkan ke cloud.', 'success');
        }
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Sinkronisasi target harian gagal: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else if (!silent) {
          showToast('Gagal menyinkronkan target harian ke cloud.', 'error');
        }
      } finally {
        setSyncingDaily(false);
      }
    },
    [user, isVerified, profileReady, pushDailyToCloud, showToast]
  );

  const setDailyGoal = useCallback(
    (goal: number) => {
      if (!(DAILY_GOAL_OPTIONS as readonly number[]).includes(goal)) return;
      const prev = stateRef.current;
      if (prev.dailyGoal === goal) return;
      const next: DailyTrackerState = { ...prev, dailyGoal: goal };
      stateRef.current = next;
      setState(next);
      saveDailyTrackerState(next);
      if (user && isVerified && profileReady) {
        void pushDailyToCloud(user.uid, next);
      }
    },
    [user, isVerified, profileReady, pushDailyToCloud]
  );

  const recordMasteredChange = useCallback(
    (patternId: string, isNowMastered: boolean) => {
      const prev = stateRef.current;
      const next = recordMasteredToggleForDay(prev, patternId, isNowMastered);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      saveDailyTrackerState(next);
      if (user && isVerified && profileReady) {
        void pushDailyToCloud(user.uid, next);
      }
    },
    [user, isVerified, profileReady, pushDailyToCloud]
  );

  const recordQuizCompleted = useCallback(() => {
    const prev = stateRef.current;
    const next = recordQuizSessionForDay(prev);
    stateRef.current = next;
    setState(next);
    saveDailyTrackerState(next);
    if (user && isVerified && profileReady) {
      void pushDailyToCloud(user.uid, next);
    }
  }, [user, isVerified, profileReady, pushDailyToCloud]);

  const todayKey = formatLocalDateKey();
  const todayRecord = state.days[todayKey];
  const todayMasteredCount = todayRecord?.masteredIds.length ?? 0;
  const todayQuizCount = todayRecord?.quizSessions ?? 0;
  const currentStreak = calculateCurrentStreak(state, todayKey);
  const recent7Days = buildRecent7Days(state, todayKey);
  const dailyPct =
    state.dailyGoal > 0 ? Math.min(100, Math.round((todayMasteredCount / state.dailyGoal) * 100)) : 0;

  return {
    dailyGoal: state.dailyGoal,
    todayKey,
    todayMasteredCount,
    todayQuizCount,
    currentStreak,
    recent7Days,
    dailyPct,
    goalMetToday: todayMasteredCount >= state.dailyGoal,
    syncingDaily,
    setDailyGoal,
    recordMasteredChange,
    recordQuizCompleted,
    syncDailyWithCloud,
  };
}
