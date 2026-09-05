import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DailyCalendarProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  /** dateKeys ("YYYY-MM-DD") that have some logged activity — shown as a small dot */
  markedDates?: Set<string>;
  /** dateKeys ("YYYY-MM-DD") where every task for that day was completed — shown as a filled dot */
  completedDates?: Set<string>;
  isDark: boolean;
}

export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Aesthetic, click-to-browse month calendar used to review any previous day's progress. */
export const DailyCalendar: React.FC<DailyCalendarProps> = ({
  selectedDate,
  onSelectDate,
  markedDates,
  completedDates,
  isDark,
}) => {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const isCurrentMonthView = viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth();

  const goPrevMonth = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () => {
    if (isCurrentMonthView) return;
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };

  const firstWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  const subCardClass = isDark ? 'bg-zinc-900/70 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  return (
    <div className={`p-4 sm:p-5 rounded-3xl ${subCardClass} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-emerald-500">
          <CalendarIcon className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-wider">
            {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrevMonth}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'}`}
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            disabled={isCurrentMonthView}
            className={`p-1.5 rounded-lg transition-colors ${
              isCurrentMonthView
                ? 'opacity-25 cursor-not-allowed'
                : `cursor-pointer ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'}`
            }`}
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className={`text-[10px] font-black uppercase py-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = toDateKey(d);
          const isFuture = d.getTime() > today.getTime();
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDate);
          const hasActivity = markedDates?.has(key);
          const isCompleted = completedDates?.has(key);

          return (
            <button
              key={i}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDate(startOfDay(d))}
              className={`relative aspect-square rounded-xl text-xs font-bold flex items-center justify-center transition-all ${
                isFuture
                  ? `cursor-not-allowed ${isDark ? 'text-zinc-800' : 'text-zinc-300'}`
                  : isSelected
                    ? 'bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/30 cursor-pointer'
                    : isToday
                      ? `border-2 border-emerald-500 text-emerald-500 cursor-pointer ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-emerald-50'}`
                      : `cursor-pointer ${isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-200'}`
              }`}
              title={d.toDateString()}
            >
              {d.getDate()}
              {!isFuture && (hasActivity || isCompleted) && !isSelected && (
                <span
                  className={`absolute bottom-1 w-1.25 h-1.25 rounded-full ${isCompleted ? 'bg-emerald-500' : isDark ? 'bg-zinc-600' : 'bg-zinc-400'}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
