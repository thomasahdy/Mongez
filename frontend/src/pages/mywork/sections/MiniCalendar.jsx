import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useLocaleDirection from "../../../hooks/useLocaleDirection";

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];

  for (let index = 0; index < firstDay; index += 1) {
    grid.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(day);
  }

  return grid;
}

function toDayKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MiniCalendar = ({ taskDays = new Set() }) => {
  const { t, i18n } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));
  const dayHeaders = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
      new Date(2024, 0, index + 7),
    ),
  );
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
      return;
    }

    setViewMonth((month) => month - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
      return;
    }

    setViewMonth((month) => month + 1);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4" dir={dir}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <i className="fa-regular fa-calendar text-sky-500" aria-hidden="true" />
          {monthLabel}
        </h4>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={t("myWorkPage.previousMonth")}
          >
            <i className={`fa-solid ${isRtl ? "fa-chevron-right" : "fa-chevron-left"} text-[10px]`} />
          </button>
          <button
            onClick={nextMonth}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={t("myWorkPage.nextMonth")}
          >
            <i className={`fa-solid ${isRtl ? "fa-chevron-left" : "fa-chevron-right"} text-[10px]`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]" role="grid" aria-label={monthLabel}>
        {dayHeaders.map((dayHeader, index) => (
          <div key={index} className="py-1 font-semibold text-slate-400" role="columnheader">
            {dayHeader}
          </div>
        ))}

        {grid.map((day, index) => {
          if (!day) {
            return <div key={`blank-${index}`} />;
          }

          const isToday = isCurrentMonth && day === today;
          const hasTask = taskDays.has(toDayKey(viewYear, viewMonth, day));
          const cellLabel = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "long",
          }).format(new Date(viewYear, viewMonth, day));

          return (
            <div
              key={day}
              role="gridcell"
              aria-label={`${cellLabel}${isToday ? `, ${t("myWorkPage.today")}` : ""}${
                hasTask ? `, ${t("myWorkPage.hasTasks")}` : ""
              }`}
              className={`py-1 rounded-full cursor-pointer text-[11px] transition-colors ${
                isToday
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
};

export default MiniCalendar;
