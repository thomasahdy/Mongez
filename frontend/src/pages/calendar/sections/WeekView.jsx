import {
  eventClassName,
  formatCalendarDayNumber,
  formatCalendarWeekdayLabel,
  formatDateKey,
  isSameDay,
} from "../calendarUtils";

export default function WeekView({
  calendarSystem,
  eventsByDate,
  isRTL,
  locale,
  nonWorkingDaySet,
  onSelectDate,
  t,
  visibleDates,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-7">
      {visibleDates.map((date) => {
        const dateKey = formatDateKey(date);
        const dateEvents = eventsByDate.get(dateKey) || [];
        const today = isSameDay(date, new Date());
        const isNonWorkingDay = nonWorkingDaySet.has(dateKey);

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(date)}
            className={`min-h-[340px] rounded-[24px] border p-4 shadow-[0_16px_35px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 ${
              isRTL ? "text-right" : "text-left"
            } ${
              today ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"
            } ${isNonWorkingDay ? "bg-slate-100/75" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {formatCalendarWeekdayLabel(date, locale, calendarSystem)}
                </div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-slate-900">
                  {formatCalendarDayNumber(date, locale, calendarSystem)}
                </div>
              </div>
              {isNonWorkingDay ? (
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  {t("calendar.labels.nonWorking")}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              {dateEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-400">{t("calendar.labels.noEvents")}</div> : null}
              {dateEvents.map((event) => (
                <div key={event.id} className={`rounded-2xl px-3 py-2.5 text-[12px] font-medium leading-5 ${eventClassName(event.type)}`}>
                  <div>{event.title}</div>
                  {event.detail ? <div className="mt-1 text-[11px] opacity-80">{event.detail}</div> : null}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
