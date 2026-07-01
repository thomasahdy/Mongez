import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { writeStorageJson, writeStorageValue } from "../../utils/browserStorage";
import {
  useCalendarEventsQuery,
  useCalendarPreferencesQuery,
  useGoogleCalendarStatusQuery,
} from "../../hooks/useCalendarQueries";
import calendarService from "../../services/api/calendarService";
import CalendarBoardSkeleton from "./CalendarBoardSkeleton";
import {
  CALENDAR_SYSTEM_STORAGE_KEY,
  CALENDAR_VIEWS,
  STORAGE_KEY,
  addCalendarMonths,
  addDays,
  buildNonWorkingEntries,
  buildViewTabs,
  formatCalendarWeekdayLabel,
  formatDateKey,
  getMonthRange,
  getNavTargetDate,
  getSafeRedirectUrl,
  getVisibleRange,
  normalizeEvents,
  readCalendarSystem,
  readFilters,
  startOfDay,
  startOfWeek,
  endOfWeek,
} from "./calendarUtils";
import CalendarFiltersPanel from "./sections/CalendarFiltersPanel";
import CalendarLegend from "./sections/CalendarLegend";
import CalendarSidebar from "./sections/CalendarSidebar";
import CalendarToolbar from "./sections/CalendarToolbar";
import CalendarViewTabs from "./sections/CalendarViewTabs";
import DayView from "./sections/DayView";
import MonthView from "./sections/MonthView";
import WeekView from "./sections/WeekView";

export default function CalendarPage() {
  const { setPath, activeBoard: outletBoard } = useOutletContext() || {};
  const { activeSpace, activeSpaceId, activeBoard, activeBoardId, user } = useAppContext();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const resolvedBoard = outletBoard || activeBoard;
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const [calendarSystem, setCalendarSystem] = useState(() => readCalendarSystem(i18n.language));
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarView, setCalendarView] = useState("month");
  const [draftFilters, setDraftFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [appliedFilters, setAppliedFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [selectedDayEventsExpanded, setSelectedDayEventsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const googlePopupIntervalRef = useRef(null);

  const preferencesQuery = useCalendarPreferencesQuery();
  const googleStatusQuery = useGoogleCalendarStatusQuery(activeSpaceId);
  const preferences = preferencesQuery.data || null;

  const viewTabs = useMemo(() => buildViewTabs(resolvedBoard?.id || activeBoardId, t), [activeBoardId, resolvedBoard?.id, t]);
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        formatCalendarWeekdayLabel(new Date(2026, 0, 4 + index), locale, calendarSystem),
      ),
    [calendarSystem, locale],
  );
  const legendItems = useMemo(
    () => [
      { label: t("calendar.legend.0"), className: "bg-sky-100 text-sky-700 border-sky-200" },
      { label: t("calendar.legend.1"), className: "bg-rose-100 text-rose-700 border-rose-200" },
      { label: t("calendar.legend.2"), className: "bg-violet-100 text-violet-700 border-violet-200" },
      { label: t("calendar.legend.3"), className: "bg-amber-100 text-amber-700 border-amber-200" },
      { label: t("calendar.legend.4"), className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      { label: t("calendar.legend.5"), className: "bg-slate-200 text-slate-700 border-slate-300" },
    ],
    [t],
  );

  const visibleRange = useMemo(() => {
    if (calendarView !== "month") {
      return getVisibleRange(anchorDate, calendarView);
    }

    const monthRange = getMonthRange(anchorDate, locale, calendarSystem);
    return {
      start: startOfWeek(monthRange.start),
      end: endOfWeek(monthRange.end),
    };
  }, [anchorDate, calendarSystem, calendarView, locale]);

  const resolvedAppliedFilters = useMemo(
    () => ({
      spaceId: appliedFilters.spaceId.trim() || activeSpaceId || "",
      boardId: appliedFilters.boardId.trim() || activeBoardId || "",
      holidayCountry: appliedFilters.holidayCountry.trim() || preferences?.holidayCountry || "",
    }),
    [
      activeBoardId,
      activeSpaceId,
      appliedFilters.boardId,
      appliedFilters.holidayCountry,
      appliedFilters.spaceId,
      preferences?.holidayCountry,
    ],
  );

  const calendarEventsQuery = useCalendarEventsQuery({
    from: formatDateKey(visibleRange.start),
    to: formatDateKey(visibleRange.end),
    spaceId: resolvedAppliedFilters.spaceId,
    boardId: resolvedAppliedFilters.boardId,
    holidayCountry: resolvedAppliedFilters.holidayCountry,
    enabled: Boolean(visibleRange.start && visibleRange.end),
  });

  const normalizedEvents = useMemo(() => normalizeEvents(calendarEventsQuery.data, t), [calendarEventsQuery.data, t]);
  const events = normalizedEvents.items;
  const invalidEventCount = normalizedEvents.invalidCount;
  const loading = calendarEventsQuery.isLoading || calendarEventsQuery.isFetching;
  const initialCalendarLoading = calendarEventsQuery.isLoading && !calendarEventsQuery.data;

  const visibleDates = useMemo(() => {
    const dates = [];
    let cursor = new Date(visibleRange.start);

    while (cursor <= visibleRange.end) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return dates;
  }, [visibleRange.end, visibleRange.start]);

  const eventsByDate = useMemo(() => {
    const groupedEvents = new Map();

    events.forEach((event) => {
      const key = event.dateKey;
      const existing = groupedEvents.get(key) || [];
      existing.push(event);
      groupedEvents.set(key, existing);
    });

    return groupedEvents;
  }, [events]);

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const nonWorkingEntries = useMemo(
    () => buildNonWorkingEntries(visibleDates, eventsByDate, resolvedAppliedFilters.holidayCountry),
    [eventsByDate, resolvedAppliedFilters.holidayCountry, visibleDates],
  );
  const nonWorkingDaySet = useMemo(() => new Set(nonWorkingEntries.map((entry) => entry.dateKey)), [nonWorkingEntries]);
  const nonWorkingCountryLabel = draftFilters.holidayCountry || preferences?.holidayCountry || t("calendar.labels.noCountry");

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: t("calendar.title"), color: "text-slate-800", ref: "/calendar" },
    ]);
  }, [activeSpace?.name, setPath, t]);

  useEffect(() => {
    writeStorageJson(STORAGE_KEY, appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    writeStorageValue(CALENDAR_SYSTEM_STORAGE_KEY, calendarSystem);
  }, [calendarSystem]);

  useEffect(() => {
    return () => {
      if (googlePopupIntervalRef.current) {
        window.clearInterval(googlePopupIntervalRef.current);
      }
    };
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const { url } = await calendarService.connectGoogleCalendar(activeSpaceId);
      const safeUrl = getSafeRedirectUrl(url);

      if (!safeUrl) {
        return;
      }

      const popup = window.open(safeUrl, "_blank", "width=600,height=600");

      if (!popup) {
        window.location.assign(safeUrl);
        return;
      }

      try {
        popup.opener = null;
      } catch {
        // Some browsers do not allow assigning opener on cross-origin popups.
      }

      if (googlePopupIntervalRef.current) {
        window.clearInterval(googlePopupIntervalRef.current);
      }

      googlePopupIntervalRef.current = window.setInterval(() => {
        if (!popup || popup.closed) {
          window.clearInterval(googlePopupIntervalRef.current);
          googlePopupIntervalRef.current = null;
          googleStatusQuery.refetch();
          calendarEventsQuery.refetch();
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to connect Google Calendar:", err);
    }
  };

  const handleSyncGoogle = async () => {
    setIsSyncing(true);
    try {
      await calendarService.syncGoogleCalendar(activeSpaceId);
      googleStatusQuery.refetch();
      calendarEventsQuery.refetch();
    } catch (err) {
      console.error("Failed to sync Google Calendar:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNavigate = (direction) => {
    const nextAnchorDate =
      calendarView === "month"
        ? addCalendarMonths(anchorDate, direction, locale, calendarSystem)
        : getNavTargetDate(anchorDate, calendarView, direction);
    const nextSelectedDate =
      calendarView === "month"
        ? getMonthRange(nextAnchorDate, locale, calendarSystem).start
        : startOfDay(nextAnchorDate);
    setAnchorDate(nextAnchorDate);
    setSelectedDate(nextSelectedDate);
  };

  const handleGoToToday = () => {
    const today = startOfDay(new Date());
    setAnchorDate(today);
    setSelectedDate(today);
  };

  const handleChangeView = (nextView) => {
    const normalizedView = CALENDAR_VIEWS.includes(nextView) ? nextView : "month";
    const nextSelectedDate =
      normalizedView === "month" ? getMonthRange(anchorDate, locale, calendarSystem).start : startOfDay(anchorDate);
    setCalendarView(normalizedView);
    setSelectedDate(nextSelectedDate);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      spaceId: draftFilters.spaceId.trim(),
      boardId: draftFilters.boardId.trim(),
      holidayCountry: draftFilters.holidayCountry.trim().toUpperCase(),
    });
    setSelectedDayEventsExpanded(false);
  };

  const handleUseActiveWorkspace = () => {
    setDraftFilters((current) => ({
      ...current,
      spaceId: activeSpaceId || "",
      boardId: activeBoardId || "",
    }));
  };

  const handleClearFilters = () => {
    const nextFilters = {
      spaceId: activeSpaceId || "",
      boardId: "",
      holidayCountry: preferences?.holidayCountry || "",
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSelectedDayEventsExpanded(false);
  };

  const handleSelectDate = (date) => {
    setSelectedDate(startOfDay(date));
    setSelectedDayEventsExpanded(false);
  };

  const pageError = preferencesQuery.isError
    ? preferencesQuery.error?.message || t("calendar.notices.preferencesFailed")
    : calendarEventsQuery.isError
      ? calendarEventsQuery.error?.message || t("calendar.notices.calendarFailed")
      : "";

  return (
    <div className="page-motion-calendar flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900" dir={isRTL ? "rtl" : "ltr"}>
      <CalendarViewTabs isRTL={isRTL} viewTabs={viewTabs} />

      <main className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <CalendarToolbar
            anchorDate={anchorDate}
            calendarSystem={calendarSystem}
            calendarView={calendarView}
            isRTL={isRTL}
            loading={loading}
            locale={locale}
            onChangeCalendarSystem={setCalendarSystem}
            onChangeView={handleChangeView}
            onGoToToday={handleGoToToday}
            onNavigate={handleNavigate}
            onRefresh={handleApplyFilters}
            t={t}
          />

          {pageError ? (
            <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-600">{pageError}</div>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-5">
              <CalendarFiltersPanel
                draftFilters={draftFilters}
                invalidEventCount={invalidEventCount}
                isRTL={isRTL}
                onApplyFilters={handleApplyFilters}
                onClearFilters={handleClearFilters}
                onUpdateDraftFilters={setDraftFilters}
                onUseActiveWorkspace={handleUseActiveWorkspace}
                preferences={preferences}
                t={t}
              >
                {initialCalendarLoading ? (
                  <CalendarBoardSkeleton />
                ) : (
                  <>
                    {calendarView === "month" ? (
                      <MonthView
                        anchorDate={anchorDate}
                        calendarSystem={calendarSystem}
                        eventsByDate={eventsByDate}
                        isRTL={isRTL}
                        locale={locale}
                        nonWorkingDaySet={nonWorkingDaySet}
                        onSelectDate={handleSelectDate}
                        selectedDate={selectedDate}
                        t={t}
                        visibleDates={visibleDates}
                        weekdayLabels={weekdayLabels}
                      />
                    ) : null}
                    {calendarView === "week" ? (
                      <WeekView
                        calendarSystem={calendarSystem}
                        eventsByDate={eventsByDate}
                        isRTL={isRTL}
                        locale={locale}
                        nonWorkingDaySet={nonWorkingDaySet}
                        onSelectDate={handleSelectDate}
                        t={t}
                        visibleDates={visibleDates}
                      />
                    ) : null}
                    {calendarView === "day" ? (
                      <DayView
                        calendarSystem={calendarSystem}
                        eventsByDate={eventsByDate}
                        locale={locale}
                        nonWorkingDaySet={nonWorkingDaySet}
                        selectedDate={selectedDate}
                        selectedDateKey={selectedDateKey}
                      />
                    ) : null}
                  </>
                )}
              </CalendarFiltersPanel>

              <CalendarLegend legendItems={legendItems} />
            </div>

            <CalendarSidebar
              activeSpace={activeSpace}
              calendarSystem={calendarSystem}
              countryLabel={nonWorkingCountryLabel}
              draftFilters={draftFilters}
              googleStatus={googleStatusQuery.data}
              isRTL={isRTL}
              isSyncing={isSyncing}
              locale={locale}
              nonWorkingEntries={nonWorkingEntries}
              onConnectGoogle={handleConnectGoogle}
              onSyncGoogle={handleSyncGoogle}
              onToggleSelectedDayEvents={() => setSelectedDayEventsExpanded((value) => !value)}
              preferences={preferences}
              resolvedBoard={resolvedBoard}
              selectedDate={selectedDate}
              selectedDayEvents={selectedDayEvents}
              selectedDayEventsExpanded={selectedDayEventsExpanded}
              t={t}
              user={user}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
