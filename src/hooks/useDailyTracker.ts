import { useCallback, useEffect, useState } from 'react';
import type { DailyTrackerState } from '../types/bunpou';
import {
  buildRecent7Days,
  calculateCurrentStreak,
  DAILY_GOAL_OPTIONS,
  formatLocalDateKey,
  loadDailyTrackerState,
  recordMasteredToggleForDay,
  recordQuizSessionForDay,
  saveDailyTrackerState,
} from '../utils/dailyProgress';

export function useDailyTracker() {
  const [state, setState] = useState<DailyTrackerState>(() => loadDailyTrackerState());

  useEffect(() => {
    saveDailyTrackerState(state);
  }, [state]);

  const setDailyGoal = useCallback((goal: number) => {
    if (!(DAILY_GOAL_OPTIONS as readonly number[]).includes(goal)) return;
    setState(prev => ({ ...prev, dailyGoal: goal }));
  }, []);

  const recordMasteredChange = useCallback((patternId: string, isNowMastered: boolean) => {
    setState(prev => recordMasteredToggleForDay(prev, patternId, isNowMastered));
  }, []);

  const recordQuizCompleted = useCallback(() => {
    setState(prev => recordQuizSessionForDay(prev));
  }, []);

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
    setDailyGoal,
    recordMasteredChange,
    recordQuizCompleted,
  };
}
