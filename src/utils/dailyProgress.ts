import type { DailyActivityDay, DailyTrackerState } from '../types/bunpou';
import { ALL_KOTOBA_WORDS } from '../data/minnaKotobaData';
import { ALL_VALID_PATTERN_IDS } from './bunpouSync';

const ALL_VALID_STUDY_IDS = new Set<string>([
  ...ALL_VALID_PATTERN_IDS,
  ...ALL_KOTOBA_WORDS.map(w => w.id),
]);

export const DAILY_TRACKER_STORAGE_KEY = 'minna_bunpou_daily_v1';
export const DAILY_GOAL_OPTIONS = [3, 5, 10, 15] as const;
export const DEFAULT_DAILY_GOAL = 5;
const MAX_STORED_DAYS = 90;

export function formatLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return formatLocalDateKey(dt);
}

export function createEmptyDailyTrackerState(dailyGoal = DEFAULT_DAILY_GOAL): DailyTrackerState {
  return {
    dailyGoal,
    days: {},
  };
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function sanitizeDailyTrackerState(raw: unknown): DailyTrackerState {
  if (!raw || typeof raw !== 'object') return createEmptyDailyTrackerState();
  const obj = raw as Record<string, unknown>;
  const rawGoal = typeof obj.dailyGoal === 'number' ? obj.dailyGoal : DEFAULT_DAILY_GOAL;
  const dailyGoal = (DAILY_GOAL_OPTIONS as readonly number[]).includes(rawGoal)
    ? rawGoal
    : DEFAULT_DAILY_GOAL;

  const days: Record<string, DailyActivityDay> = {};
  const rawDays = obj.days;
  if (rawDays && typeof rawDays === 'object') {
    const entries = Object.entries(rawDays as Record<string, unknown>)
      .filter(([key]) => isValidDateKey(key))
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, MAX_STORED_DAYS);

    for (const [dateKey, val] of entries) {
      if (!val || typeof val !== 'object') continue;
      const entry = val as Record<string, unknown>;
      const rawIds = Array.isArray(entry.masteredIds) ? entry.masteredIds : [];
      const seen = new Set<string>();
      const masteredIds: string[] = [];
      for (const id of rawIds) {
        if (typeof id === 'string' && ALL_VALID_STUDY_IDS.has(id) && !seen.has(id)) {
          seen.add(id);
          masteredIds.push(id);
        }
      }
      const quizSessions =
        typeof entry.quizSessions === 'number' && Number.isFinite(entry.quizSessions)
          ? Math.max(0, Math.min(200, Math.floor(entry.quizSessions)))
          : 0;
      if (masteredIds.length > 0 || quizSessions > 0) {
        days[dateKey] = {
          date: dateKey,
          masteredIds,
          quizSessions,
        };
      }
    }
  }

  return { dailyGoal, days };
}

export function loadDailyTrackerState(): DailyTrackerState {
  try {
    if (typeof localStorage === 'undefined') return createEmptyDailyTrackerState();
    const raw = localStorage.getItem(DAILY_TRACKER_STORAGE_KEY);
    if (!raw) return createEmptyDailyTrackerState();
    return sanitizeDailyTrackerState(JSON.parse(raw));
  } catch {
    return createEmptyDailyTrackerState();
  }
}

export function saveDailyTrackerState(state: DailyTrackerState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DAILY_TRACKER_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage write errors
  }
}

export function recordMasteredToggleForDay(
  state: DailyTrackerState,
  patternId: string,
  isNowMastered: boolean,
  dateKey: string = formatLocalDateKey()
): DailyTrackerState {
  if (!ALL_VALID_STUDY_IDS.has(patternId)) return state;
  const existing = state.days[dateKey] ?? {
    date: dateKey,
    masteredIds: [],
    quizSessions: 0,
  };

  let nextIds: string[];
  if (isNowMastered) {
    nextIds = existing.masteredIds.includes(patternId)
      ? existing.masteredIds
      : [...existing.masteredIds, patternId];
  } else {
    nextIds = existing.masteredIds.filter(id => id !== patternId);
  }

  const nextDays: Record<string, DailyActivityDay> = { ...state.days };
  if (nextIds.length === 0 && existing.quizSessions === 0) {
    delete nextDays[dateKey];
  } else {
    nextDays[dateKey] = {
      date: dateKey,
      masteredIds: nextIds,
      quizSessions: existing.quizSessions,
    };
  }

  return {
    ...state,
    days: nextDays,
  };
}

export function recordQuizSessionForDay(
  state: DailyTrackerState,
  dateKey: string = formatLocalDateKey()
): DailyTrackerState {
  const existing = state.days[dateKey] ?? {
    date: dateKey,
    masteredIds: [],
    quizSessions: 0,
  };

  return {
    ...state,
    days: {
      ...state.days,
      [dateKey]: {
        date: dateKey,
        masteredIds: existing.masteredIds,
        quizSessions: existing.quizSessions + 1,
      },
    },
  };
}

export function isDayActive(day: DailyActivityDay | undefined): boolean {
  if (!day) return false;
  return day.masteredIds.length > 0 || day.quizSessions > 0;
}

/**
 * Counts consecutive active days ending today (or yesterday if today has no activity yet).
 */
export function calculateCurrentStreak(
  state: DailyTrackerState,
  todayKey: string = formatLocalDateKey()
): number {
  let cursor = todayKey;
  if (!isDayActive(state.days[cursor])) {
    cursor = shiftDateKey(todayKey, -1);
    if (!isDayActive(state.days[cursor])) {
      return 0;
    }
  }

  let streak = 0;
  while (isDayActive(state.days[cursor])) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
    if (streak > 365) break;
  }
  return streak;
}

export interface RecentDaySummary {
  date: string;
  weekdayShort: string;
  dayOfMonth: number;
  masteredCount: number;
  quizSessions: number;
  goalMet: boolean;
  isToday: boolean;
}

const WEEKDAY_ID_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function buildRecent7Days(
  state: DailyTrackerState,
  todayKey: string = formatLocalDateKey()
): RecentDaySummary[] {
  const list: RecentDaySummary[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const dateKey = shiftDateKey(todayKey, offset);
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const record = state.days[dateKey];
    const masteredCount = record?.masteredIds.length ?? 0;
    const quizSessions = record?.quizSessions ?? 0;

    list.push({
      date: dateKey,
      weekdayShort: WEEKDAY_ID_SHORT[dt.getDay()] ?? '',
      dayOfMonth: d || dt.getDate(),
      masteredCount,
      quizSessions,
      goalMet: masteredCount >= state.dailyGoal,
      isToday: offset === 0,
    });
  }
  return list;
}
