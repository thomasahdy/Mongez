import { CALENDAR_SYSTEMS, CALENDAR_VIEWS, formatCalendarMonthLabel } from "../calendarUtils";

export default function CalendarToolbar({
  anchorDate,
  calendarSystem,
  calendarView,
  isRTL,
  loading,
  locale,
  onChangeCalendarSystem,
  onChangeView,
  onGoToToday,
  onNavigate,
  onRefresh,
  t,
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className={`flex flex-wrap items-center gap-3 ${isRTL ? "xl:flex-row-reverse" : ""}`}>
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <i className={`fa-solid ${isRTL ? "fa-chevron-right" : "fa-chevron-left"}`} />
          </button>
          <div className="min-w-[180px] text-[26px] font-black tracking-[-0.05em] text-slate-900">
            {formatCalendarMonthLabel(anchorDate, locale, calendarSystem)}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"}`} />
          </button>
          <button
            type="button"
            onClick={onGoToToday}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
          >
            {t("calendar.controls.today")}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
          >
            <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-rotate-right"} ${isRTL ? "ml-2" : "mr-2"}`} />
            {t("calendar.controls.refresh")}
          </button>
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t("calendar.calendarSystems.label")}
            </span>
            {CALENDAR_SYSTEMS.map((system) => (
              <button
                key={system}
                type="button"
                onClick={() => onChangeCalendarSystem(system)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  calendarSystem === system
                    ? "bg-sky-500 text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-700"
                }`}
              >
                {t(`calendar.calendarSystems.${system}`)}
              </button>
            ))}
          </div>
          {CALENDAR_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => onChangeView(view)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold capitalize transition ${
                calendarView === view
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {t(`calendar.views.${view}`)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
