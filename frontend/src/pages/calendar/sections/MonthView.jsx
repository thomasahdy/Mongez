import {
  eventClassName,
  formatCalendarDayNumber,
  formatDateKey,
  isSameDay,
} from "../calendarUtils";

export default function MonthView({
  anchorDate,
  calendarSystem,
  eventsByDate,
  isRTL,
  locale,
  nonWorkingDaySet,
  onSelectDate,
  selectedDate,
  t,
  visibleDates,
  weekdayLabels,
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {visibleDates.map((date) => {
          const isOtherMonth = date.getMonth() !== anchorDate.getMonth();
          const isToday = isSameDay(date, new Date());
          const isSelected = isSameDay(date, selectedDate);
          const dateKey = formatDateKey(date);
          const dateEvents = eventsByDate.get(dateKey) || [];
          const isNonWorkingDay = nonWorkingDaySet.has(dateKey);
          const primaryDayNumber = formatCalendarDayNumber(date, locale, calendarSystem);
          const secondaryDayNumber =
            calendarSystem === "islamic" ? formatCalendarDayNumber(date, locale, "gregory") : null;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`min-h-[138px] border-b p-2.5 transition-colors hover:bg-slate-50 ${
                isRTL ? "border-l border-slate-200 text-right last:border-l-0" : "border-r border-slate-200 text-left last:border-r-0"
              } ${
                isOtherMonth ? "bg-slate-50/60 text-slate-300" : "bg-white"
              } ${isSelected ? "bg-sky-50/70" : ""} ${isNonWorkingDay ? "bg-slate-100/75" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-semibold ${
                    isToday ? "bg-sky-500 text-white" : "text-slate-700"
                  }`}
                >
                  {primaryDayNumber}
                </span>
                {secondaryDayNumber ? <span className="text-[10px] font-semibold text-slate-400">{secondaryDayNumber}</span> : null}
                {isNonWorkingDay ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    {t("calendar.labels.off")}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {dateEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className={`truncate rounded-lg px-2 py-1 text-[11px] font-medium ${eventClassName(event.type)}`}>
                    {event.title}
                  </div>
                ))}
                {dateEvents.length > 3 ? (
                  <div className="px-1 text-[10px] font-semibold text-slate-400">{t("calendar.labels.more", { count: dateEvents.length - 3 })}</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
