import { useVirtualList } from "../../../hooks/useVirtualList";
import {
  NON_WORKING_WEEKEND,
  eventClassName,
  formatCalendarLongDayLabel,
  formatLongDayLabel,
} from "../calendarUtils";

function SelectedDayPanel({
  calendarSystem,
  locale,
  onToggleExpanded,
  selectedDate,
  selectedDayEvents,
  selectedDayEventsExpanded,
  t,
}) {
  const shouldVirtualizeSelectedEvents = selectedDayEventsExpanded && selectedDayEvents.length > 24;
  const {
    handleScroll: handleSelectedEventVirtualScroll,
    measureViewport: measureSelectedEventViewport,
    totalHeight: selectedEventVirtualHeight,
    virtualItems: virtualSelectedEvents,
  } = useVirtualList(selectedDayEvents, { itemHeight: 74, overscan: 6 });

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.labels.selectedDay")}</div>
      <h2 className="text-[22px] font-black tracking-[-0.04em] text-slate-900">
        {formatCalendarLongDayLabel(selectedDate, locale, calendarSystem)}
      </h2>
      {calendarSystem === "islamic" ? (
        <div className="mt-1 text-xs font-semibold text-slate-400">
          {t("calendar.labels.gregorian")}: {formatLongDayLabel(selectedDate, locale)}
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {selectedDayEvents.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">{t("calendar.labels.noEventsSelectedDay")}</div>
        ) : null}

        {shouldVirtualizeSelectedEvents ? (
          <div
            ref={measureSelectedEventViewport}
            onScroll={handleSelectedEventVirtualScroll}
            className="relative max-h-80 overflow-y-auto pr-1"
          >
            <div className="relative" style={{ height: selectedEventVirtualHeight }}>
              {virtualSelectedEvents.map(({ item: event, offsetTop }) => (
                <article
                  key={event.id}
                  className={`absolute left-0 right-0 rounded-[22px] px-3.5 py-3 ${eventClassName(event.type)}`}
                  style={{ transform: `translateY(${offsetTop}px)`, minHeight: 66 }}
                >
                  <div className="text-[12px] font-semibold">{event.title}</div>
                  {event.detail ? <div className="mt-1 text-[11px] opacity-80">{event.detail}</div> : null}
                </article>
              ))}
            </div>
          </div>
        ) : (
          (selectedDayEventsExpanded ? selectedDayEvents : selectedDayEvents.slice(0, 4)).map((event) => (
            <article key={event.id} className={`rounded-[22px] px-3.5 py-3 ${eventClassName(event.type)}`}>
              <div className="text-[12px] font-semibold">{event.title}</div>
              {event.detail ? <div className="mt-1 text-[11px] opacity-80">{event.detail}</div> : null}
            </article>
          ))
        )}

        {selectedDayEvents.length > 4 ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="text-[12px] font-semibold text-sky-600 hover:text-sky-700"
          >
            {selectedDayEventsExpanded ? t("calendar.labels.showLess") : t("calendar.labels.showAllEvents", { count: selectedDayEvents.length })}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function NonWorkingDaysPanel({
  calendarSystem,
  countryLabel,
  isRTL,
  locale,
  nonWorkingEntries,
  t,
}) {
  const shouldVirtualizeNonWorkingEntries = nonWorkingEntries.length > 28;
  const {
    handleScroll: handleNonWorkingVirtualScroll,
    measureViewport: measureNonWorkingViewport,
    totalHeight: nonWorkingVirtualHeight,
    virtualItems: virtualNonWorkingEntries,
  } = useVirtualList(nonWorkingEntries, { itemHeight: 72, overscan: 6 });

  const renderEntry = (entry, style, className = "") => (
    <div
      key={`${entry.dateKey}-${entry.label}`}
      className={`${className} rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5`}
      style={style}
    >
      <div className={`text-[12px] font-semibold text-slate-700 ${isRTL ? "text-right" : "text-left"}`}>
        {formatCalendarLongDayLabel(new Date(entry.dateKey), locale, calendarSystem)}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {t("calendar.labels.holidaySource", {
          label: entry.label === NON_WORKING_WEEKEND ? t("calendar.labels.weekend") : entry.label,
          source: entry.source === NON_WORKING_WEEKEND ? t("calendar.labels.weekend") : entry.source,
        })}
      </div>
    </div>
  );

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className={`mb-3 flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.labels.nonWorkingDays")}</div>
          <div className="mt-1 text-sm text-slate-500">
            {t("calendar.labels.holidaysAndWeekends", { country: countryLabel })}
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
          {t("calendar.labels.inRange", { count: nonWorkingEntries.length })}
        </div>
      </div>

      <div className="space-y-2">
        {nonWorkingEntries.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">
            {t("calendar.labels.noNonWorkingDays")}
          </div>
        ) : null}

        {shouldVirtualizeNonWorkingEntries ? (
          <div
            ref={measureNonWorkingViewport}
            onScroll={handleNonWorkingVirtualScroll}
            className="relative max-h-80 overflow-y-auto pr-1"
          >
            <div className="relative" style={{ height: nonWorkingVirtualHeight }}>
              {virtualNonWorkingEntries.map(({ item: entry, offsetTop }) =>
                renderEntry(entry, { transform: `translateY(${offsetTop}px)`, minHeight: 64 }, "absolute left-0 right-0"),
              )}
            </div>
          </div>
        ) : (
          nonWorkingEntries.map((entry) => renderEntry(entry))
        )}
      </div>
    </section>
  );
}

function GoogleCalendarPanel({
  googleStatus,
  isRTL,
  isSyncing,
  locale,
  onConnectGoogle,
  onSyncGoogle,
  t,
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.google.title")}</div>
      <div className="space-y-3">
        {googleStatus?.connected ? (
          <>
            <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[13px] font-semibold text-slate-700">{t("calendar.google.connected")}</span>
            </div>
            {googleStatus?.lastSyncAt ? (
              <div className="text-[11px] text-slate-400">
                {t("calendar.google.lastSynced", {
                  value: new Date(googleStatus.lastSyncAt).toLocaleString(locale),
                })}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSyncGoogle}
              disabled={isSyncing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <i className={`fa-solid fa-arrows-rotate ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? t("calendar.google.syncing") : t("calendar.google.syncNow")}
            </button>
          </>
        ) : (
          <>
            <div className="text-[12px] leading-normal text-slate-500">
              {t("calendar.google.connectDescription")}
            </div>
            <button
              type="button"
              onClick={onConnectGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-indigo-700"
            >
              <i className="fa-brands fa-google" />
              {t("calendar.google.connectButton")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function CalendarScopePanel({
  activeSpace,
  draftFilters,
  preferences,
  resolvedBoard,
  t,
  user,
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.labels.calendarScope")}</div>
      <div className="mt-3 space-y-2 text-[13px] text-slate-500">
        <div>
          {t("calendar.labels.workspace", { value: activeSpace?.name || draftFilters.spaceId || t("calendar.labels.notSelected") })}
        </div>
        <div>
          {t("calendar.labels.board", { value: resolvedBoard?.name || draftFilters.boardId || t("calendar.labels.allBoards") })}
        </div>
        <div>
          {t("calendar.labels.timezone", { value: preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </div>
        <div>
          {t("calendar.labels.viewer", { value: user?.email || user?.name || t("common.selected") })}
        </div>
      </div>
    </section>
  );
}

export default function CalendarSidebar({
  activeSpace,
  calendarSystem,
  countryLabel,
  draftFilters,
  googleStatus,
  isRTL,
  isSyncing,
  locale,
  nonWorkingEntries,
  onConnectGoogle,
  onSyncGoogle,
  onToggleSelectedDayEvents,
  preferences,
  resolvedBoard,
  selectedDate,
  selectedDayEvents,
  selectedDayEventsExpanded,
  t,
  user,
}) {
  return (
    <aside className="space-y-5">
      <SelectedDayPanel
        calendarSystem={calendarSystem}
        locale={locale}
        onToggleExpanded={onToggleSelectedDayEvents}
        selectedDate={selectedDate}
        selectedDayEvents={selectedDayEvents}
        selectedDayEventsExpanded={selectedDayEventsExpanded}
        t={t}
      />
      <NonWorkingDaysPanel
        calendarSystem={calendarSystem}
        countryLabel={countryLabel}
        isRTL={isRTL}
        locale={locale}
        nonWorkingEntries={nonWorkingEntries}
        t={t}
      />
      <GoogleCalendarPanel
        googleStatus={googleStatus}
        isRTL={isRTL}
        isSyncing={isSyncing}
        locale={locale}
        onConnectGoogle={onConnectGoogle}
        onSyncGoogle={onSyncGoogle}
        t={t}
      />
      <CalendarScopePanel
        activeSpace={activeSpace}
        draftFilters={draftFilters}
        preferences={preferences}
        resolvedBoard={resolvedBoard}
        t={t}
        user={user}
      />
    </aside>
  );
}
