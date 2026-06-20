import React, { useMemo, useState } from 'react'


const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HEADERS = ["S","M","T","W","T","F","S"];
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  for (let i = 0; i < firstDay; i++) grid.push(null); // leading blanks
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}
const MiniCalendar = ({ taskDays = new Set() }) => {
  const now = new Date();
    const [viewYear,  setViewYear]  = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
   
    const today = now.getDate();
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);
   
    const prevMonth = () => {
      if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
      else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
      else setViewMonth((m) => m + 1);
    };
   
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <i className="fa-regular fa-calendar text-sky-500" aria-hidden="true" />
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h4>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Previous month">
              <i className="fa-solid fa-chevron-left text-[10px]" />
            </button>
            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Next month">
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
          </div>
        </div>
   
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]" role="grid" aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}>
          {/* Day headers */}
          {DAY_HEADERS.map((d, i) => (
            <div key={i} className="py-1 font-semibold text-slate-400" role="columnheader">{d}</div>
          ))}
   
          {/* Day cells */}
          {grid.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} />;
            const isToday = isCurrentMonth && day === today;
            const hasTask = taskDays.has(day);
            return (
              <div
                key={day}
                role="gridcell"
                aria-label={`${day} ${MONTH_NAMES[viewMonth]}${isToday ? " (today)" : ""}${hasTask ? ", has tasks" : ""}`}
                className={`py-1 rounded-full cursor-pointer text-[11px] transition-colors
                  ${isToday
                    ? "bg-sky-500 text-white font-bold"
                    : hasTask
                      ? "text-slate-800 dark:text-slate-100 font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
}

export default MiniCalendar
