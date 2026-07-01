import { useTranslation } from "react-i18next";
import {
  eventClassName,
  formatCalendarLongDayLabel,
  formatLongDayLabel,
} from "../calendarUtils";

export default function DayView({
  calendarSystem,
  eventsByDate,
  locale,
  nonWorkingDaySet,
  selectedDate,
  selectedDateKey,
}) {
  const { t } = useTranslation();
  const dayEvents = eventsByDate.get(selectedDateKey) || [];
  const isNonWorkingDay = nonWorkingDaySet.has(selectedDateKey);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.labels.dayView")}</div>
          <h2 className="mt-1 text-[26px] font-black tracking-[-0.05em] text-slate-900">
            {formatCalendarLongDayLabel(selectedDate, locale, calendarSystem)}
          </h2>
          {calendarSystem === "islamic" ? (
            <div className="mt-1 text-xs font-semibold text-slate-400">
              {t("calendar.labels.gregorian")}: {formatLongDayLabel(selectedDate, locale)}
            </div>
          ) : null}
        </div>
        {isNonWorkingDay ? (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
            {t("calendar.labels.nonWorking")}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {dayEvents.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-4 text-[13px] text-slate-500">{t("calendar.labels.noEventsForDay")}</div>
        ) : null}
        {dayEvents.map((event) => (
          <article key={event.id} className={`rounded-[22px] px-4 py-4 ${eventClassName(event.type)}`}>
            <div className="text-[13px] font-semibold">{event.title}</div>
            {event.detail ? <div className="mt-1 text-[12px] opacity-80">{event.detail}</div> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
