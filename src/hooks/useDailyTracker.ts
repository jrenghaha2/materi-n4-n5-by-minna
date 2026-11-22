import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { DailyTrackerState } from '../types/bunpou';
import {
  fetchDailyTrackerDoc,
  saveDailyTrackerDoc,
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

  useEffect(() => {
    saveDailyTrackerState(state);
  }, [state]);

  const pushDailyToCloud = useCallback(
    async (uid: string, nextState: DailyTrackerState) => {
      try {
        await saveDailyTrackerDoc(uid, nextState);
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Target harian tersimpan lokal (kuota Firestore tercapai).', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    },
    [showToast]
  );

  const syncDailyWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingDaily(true);
      try {
        const remote = await fetchDailyTrackerDoc(user.uid);
        const merged = mergeDailyTrackerStates(stateRef.current, remote);
        saveDailyTrackerState(merged);
        setState(merged);

        if (!remote || !areDailyTrackerStatesEqual(merged, remote)) {
          await saveDailyTrackerDoc(user.uid, merged);
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
    [user, isVerified, profileReady, showToast]
  );

  useEffect(() => {
    if (user && isVerified && profileReady) {
      void syncDailyWithCloud(true);
    }
  }, [user, isVerified, profileReady, syncDailyWithCloud]);

  const setDailyGoal = useCallback(
    (goal: number) => {
      if (!(DAILY_GOAL_OPTIONS as readonly number[]).includes(goal)) return;
      setState(prev => {
        if (prev.dailyGoal === goal) return prev;
        const next: DailyTrackerState = { ...prev, dailyGoal: goal };
        saveDailyTrackerState(next);
        if (user && isVerified && profileReady) {
          void pushDailyToCloud(user.uid, next);
        }
        return next;
      });
    },
    [user, isVerified, profileReady, pushDailyToCloud]
  );

  const recordMasteredChange = useCallback(
    (patternId: string, isNowMastered: boolean) => {
      setState(prev => {
        const next = recordMasteredToggleForDay(prev, patternId, isNowMastered);
        if (next === prev) return prev;
        saveDailyTrackerState(next);
        if (user && isVerified && profileReady) {
          void pushDailyToCloud(user.uid, next);
        }
        return next;
      });
    },
    [user, isVerified, profileReady, pushDailyToCloud]
  );

  const recordQuizCompleted = useCallback(() => {
    setState(prev => {
      const next = recordQuizSessionForDay(prev);
      saveDailyTrackerState(next);
      if (user && isVerified && profileReady) {
        void pushDailyToCloud(user.uid, next);
      }
      return next;
    });
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

