import { useState } from 'react';
import { CalendarDays, CheckCircle2, Flame, Target } from 'lucide-react';
import { DAILY_GOAL_OPTIONS, type RecentDaySummary } from '../utils/dailyProgress';

interface DailyProgressBarProps {
  dailyGoal: number;
  todayMasteredCount: number;
  todayQuizCount: number;
  currentStreak: number;
  recent7Days: RecentDaySummary[];
  dailyPct: number;
  goalMetToday: boolean;
  onChangeGoal: (goal: number) => void;
}

export function DailyProgressBar({
  dailyGoal,
  todayMasteredCount,
  todayQuizCount,
  currentStreak,
  recent7Days,
  dailyPct,
  goalMetToday,
  onChangeGoal,
}: DailyProgressBarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const selectedDay =
    recent7Days.find(d => d.date === selectedDate) ??
    recent7Days[recent7Days.length - 1];

  return (
    <section
      id="dailyProgressSection"
      aria-label="Pelacak progres hafalan harian"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Left: Today's goal progress + streak */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {goalMetToday ? (
                <CheckCircle2
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Target
                  className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50">
                Progres Hafalan Harian
              </h2>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 font-mono-num">
                <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {currentStreak} hari beruntun
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Target/hari:</span>
              <div
                role="group"
                aria-label="Pilih target pola harian"
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5"
              >
                {DAILY_GOAL_OPTIONS.map(opt => {
                  const active = opt === dailyGoal;
                  return (
                    <button
                      key={opt}
                      type="button"
                      id={`btnDailyGoal-${opt}`}
                      aria-pressed={active}
                      onClick={() => onChangeGoal(opt)}
                      className={`px-2 py-0.5 rounded-md text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  goalMetToday
                    ? 'bg-emerald-500 dark:bg-emerald-400'
                    : 'bg-indigo-600 dark:bg-indigo-400'
                }`}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
            <span
              id="dailyProgressCounter"
              className="text-xs font-mono-num font-bold text-slate-800 dark:text-slate-100 shrink-0"
            >
              {todayMasteredCount}/{dailyGoal} pola
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {goalMetToday
              ? `Target harian tercapai! ${todayMasteredCount} pola dihafal${
                  todayQuizCount > 0 ? ` dan ${todayQuizCount} sesi kuis` : ''
                } hari ini.`
              : `Tandai ${Math.max(0, dailyGoal - todayMasteredCount)} pola lagi sebagai "Hafal" untuk memenuhi target hari ini${
                  todayQuizCount > 0 ? ` · ${todayQuizCount} sesi kuis selesai hari ini` : ''
                }.`}
          </p>
        </div>

        {/* Right: Interactive 7-day activity tracker */}
        <div className="lg:border-l lg:border-slate-200 dark:lg:border-slate-800 lg:pl-4 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              7 Hari Terakhir
            </span>
            {selectedDay ? (
              <span className="font-mono-num">
                {selectedDay.isToday ? 'Hari ini' : selectedDay.date}:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {selectedDay.masteredCount} pola
                </strong>
                {selectedDay.quizSessions > 0 ? ` · ${selectedDay.quizSessions} kuis` : ''}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Aktivitas 7 hari terakhir">
            {recent7Days.map(day => {
              const isSelected = selectedDay?.date === day.date;
              const hasActivity = day.masteredCount > 0 || day.quizSessions > 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-pressed={isSelected}
                  title={`${day.date}: ${day.masteredCount} pola hafal, ${day.quizSessions} kuis`}
                  className={`px-1.5 py-1.5 rounded-xl border text-center transition-colors cursor-pointer ${
                    day.goalMet
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : hasActivity
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  } ${
                    isSelected
                      ? 'ring-2 ring-indigo-500/60 dark:ring-indigo-400/60'
                      : ''
                  }`}
                >
                  <div className="text-[10px] font-semibold leading-none">{day.weekdayShort}</div>
                  <div className="mt-1 text-xs font-mono-num font-bold leading-none">
                    {day.masteredCount > 0 ? day.masteredCount : day.dayOfMonth}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
