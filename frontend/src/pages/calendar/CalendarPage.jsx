import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { useVirtualList } from "../../hooks/useVirtualList";
import { readStorageJson, readStorageValue, writeStorageJson, writeStorageValue } from "../../utils/browserStorage";
import {
  useCalendarEventsQuery,
  useCalendarPreferencesQuery,
  useGoogleCalendarStatusQuery,
} from "../../hooks/useCalendarQueries";
import calendarService from "../../services/api/calendarService";

const STORAGE_KEY = "mongez.calendar.filters";
const CALENDAR_SYSTEM_STORAGE_KEY = "mongez.calendar.system";
const CALENDAR_VIEWS = ["month", "week", "day"];
const CALENDAR_SYSTEMS = ["gregory", "islamic"];
const NON_WORKING_WEEKEND = "weekend";
const LOCALIZED_DIGIT_MAP = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

function CalendarBoardSkeleton() {
  return (
    <div className="calendar-skeleton rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="min-h-[120px] rounded-2xl bg-slate-100 p-3">
            <div className="h-6 w-8 rounded-full bg-slate-200" />
            <div className="mt-5 space-y-2">
              <div className="h-4 rounded-lg bg-slate-200" />
              <div className="h-4 w-2/3 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSafeRedirectUrl(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl, window.location.origin);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return "";
    }

    return parsedUrl.toString();
  } catch {
    return "";
  }
}

function readFilters(activeSpaceId, activeBoardId) {
  const parsed = readStorageJson(STORAGE_KEY, {});
  return {
    spaceId: parsed.spaceId || activeSpaceId || "",
    boardId: parsed.boardId || activeBoardId || "",
    holidayCountry: parsed.holidayCountry || "",
  };
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return startOfDay(nextDate);
}

function addMonths(date, amount) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + amount);
  return startOfDay(nextDate);
}

function startOfWeek(date) {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDayLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeDigits(value) {
  return Array.from(String(value || ""))
    .map((character) => LOCALIZED_DIGIT_MAP[character] || character)
    .join("");
}

function parseCalendarPartValue(value) {
  const normalizedValue = normalizeDigits(value).replace(/[^\d]/g, "");
  return Number.parseInt(normalizedValue, 10) || 0;
}

function readCalendarSystem(language) {
  const storedValue = readStorageValue(CALENDAR_SYSTEM_STORAGE_KEY, "");
  if (storedValue && CALENDAR_SYSTEMS.includes(storedValue)) {
    return storedValue;
  }

  return String(language || "").startsWith("ar") ? "islamic" : "gregory";
}

function getCalendarLocale(locale, calendarSystem) {
  if (calendarSystem === "islamic") {
    return locale.startsWith("ar") ? "ar-SA-u-ca-islamic" : "en-u-ca-islamic";
  }

  return locale;
}

function getCalendarParts(date, locale, calendarSystem) {
  const parts = new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  return parts.reduce((accumulator, part) => {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      accumulator[part.type] = parseCalendarPartValue(part.value);
    }
    return accumulator;
  }, {});
}

function getCalendarMonthId(date, locale, calendarSystem) {
  if (calendarSystem === "gregory") {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
  }

  const parts = getCalendarParts(date, locale, calendarSystem);
  return `${parts.year}-${parts.month}`;
}

function startOfIslamicMonth(date, locale) {
  let cursor = startOfDay(date);
  const monthId = getCalendarMonthId(cursor, locale, "islamic");
  let guard = 0;

  while (guard < 370 && getCalendarMonthId(addDays(cursor, -1), locale, "islamic") === monthId) {
    cursor = addDays(cursor, -1);
    guard += 1;
  }

  return cursor;
}

function endOfIslamicMonth(date, locale) {
  let cursor = startOfDay(date);
  const monthId = getCalendarMonthId(cursor, locale, "islamic");
  let guard = 0;

  while (guard < 370 && getCalendarMonthId(addDays(cursor, 1), locale, "islamic") === monthId) {
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  return cursor;
}

function getMonthRange(date, locale, calendarSystem) {
  if (calendarSystem === "islamic") {
    return {
      start: startOfIslamicMonth(date, locale),
      end: endOfIslamicMonth(date, locale),
    };
  }

  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

function addCalendarMonths(date, amount, locale, calendarSystem) {
  if (calendarSystem === "islamic") {
    let cursor = startOfIslamicMonth(date, locale);
    const step = amount >= 0 ? 1 : -1;

    for (let index = 0; index < Math.abs(amount); index += 1) {
      cursor =
        step > 0
          ? addDays(endOfIslamicMonth(cursor, locale), 1)
          : startOfIslamicMonth(addDays(cursor, -1), locale);
    }

    return startOfIslamicMonth(cursor, locale);
  }

  return addMonths(date, amount);
}

function formatCalendarMonthLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCalendarLongDayLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCalendarWeekdayLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    weekday: "short",
  }).format(date);
}

function formatCalendarDayNumber(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    day: "numeric",
  }).format(date);
}

function isSameDay(left, right) {
  return formatDateKey(left) === formatDateKey(right);
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function getVisibleRange(anchorDate, view) {
  if (view === "week") {
    return {
      start: startOfWeek(anchorDate),
      end: endOfWeek(anchorDate),
    };
  }

  if (view === "day") {
    return {
      start: startOfDay(anchorDate),
      end: startOfDay(anchorDate),
    };
  }

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);

  return {
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  };
}

function getNavTargetDate(anchorDate, view, direction) {
  if (view === "month") {
    return addMonths(anchorDate, direction);
  }

  return addDays(anchorDate, direction * (view === "week" ? 7 : 1));
}

function eventClassName(type) {
  switch (type) {
    case "deadline":
      return "border border-rose-200 bg-rose-50 text-rose-700";
    case "meeting":
      return "border border-violet-200 bg-violet-50 text-violet-700";
    case "milestone":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    case "holiday":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border border-sky-200 bg-sky-50 text-sky-700";
  }
}

function buildViewTabs(boardId, t) {
  return [
    { label: t("calendar.viewTabs.board"), icon: "fa-table-columns" },
    { label: t("calendar.viewTabs.list"), icon: "fa-list" },
    { label: t("calendar.viewTabs.calendar"), icon: "fa-regular fa-calendar", to: "/calendar", active: true },
    { label: t("calendar.viewTabs.gantt"), icon: "fa-bars-staggered", to: boardId ? `/board/${boardId}/timeline` : "" },
    { label: t("calendar.viewTabs.table"), icon: "fa-table-cells", to: boardId ? `/board/${boardId}/table` : "" },
  ];
}

function normalizeEvents(payload, t) {
  const rawEvents = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.events)
        ? payload.events
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

  const items = rawEvents
    .map((event, index) => {
      const startValue = event.start || event.startDate || event.date || event.dueDate || event.datetime;
      const endValue = event.end || event.endDate || event.date || event.dueDate || startValue;

      if (!startValue) {
        return null;
      }

      const startDate = startOfDay(new Date(startValue));
      const endDate = startOfDay(new Date(endValue));
      const title =
        event.title ||
        event.name ||
        event.taskTitle ||
        event.taskName ||
        t("calendar.labels.eventFallbackTitle", { index: index + 1 });
      const source = `${event.source || ""} ${event.category || ""} ${event.type || ""} ${event.status || ""} ${title}`.toLowerCase();

      let type = "task";
      if (source.includes("holiday") || title.toLowerCase().includes("holiday")) {
        type = "holiday";
      } else if (source.includes("complete") || source.includes("done")) {
        type = "done";
      } else if (source.includes("deadline") || source.includes("due")) {
        type = "deadline";
      } else if (source.includes("meeting") || source.includes("call") || source.includes("standup")) {
        type = "meeting";
      } else if (source.includes("milestone")) {
        type = "milestone";
      }

      return {
        id: event.id || event._id || event.uuid || `${formatDateKey(startDate)}-${index}`,
        title,
        type,
        startDate,
        endDate,
        dateKey: formatDateKey(startDate),
        detail: event.description || event.boardName || event.spaceName || event.status || "",
      };
    })
    .filter(Boolean);

  return {
    items,
    invalidCount: rawEvents.length - items.length,
  };
}

function buildNonWorkingEntries(visibleDates, eventsByDate, selectedCountry) {
  return visibleDates
    .filter((date) => {
      const key = formatDateKey(date);
      const entries = eventsByDate.get(key) || [];
      return isWeekend(date) || entries.some((event) => event.type === "holiday");
    })
    .map((date) => {
      const key = formatDateKey(date);
      const entries = eventsByDate.get(key) || [];
      const holiday = entries.find((event) => event.type === "holiday");

      return {
        dateKey: key,
        label: holiday ? holiday.title : NON_WORKING_WEEKEND,
        source: holiday ? selectedCountry : NON_WORKING_WEEKEND,
      };
    });
}

export default function CalendarPage() {
  const { setPath, activeBoard: outletBoard } = useOutletContext() || {};
  const { activeSpace, activeSpaceId, activeBoard, activeBoardId, user } = useAppContext();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const resolvedBoard = outletBoard || activeBoard;
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const [calendarSystem, setCalendarSystem] = useState(() => readCalendarSystem(i18n.language));
  const viewTabs = buildViewTabs(resolvedBoard?.id || activeBoardId, t);
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
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarView, setCalendarView] = useState("month");
  const [draftFilters, setDraftFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [appliedFilters, setAppliedFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [selectedDayEventsExpanded, setSelectedDayEventsExpanded] = useState(false);
  const preferencesQuery = useCalendarPreferencesQuery();
  const googleStatusQuery = useGoogleCalendarStatusQuery(activeSpaceId);
  const [isSyncing, setIsSyncing] = useState(false);
  const googlePopupIntervalRef = useRef(null);

  const handleConnectGoogle = async () => {
    try {
      const { url } = await calendarService.connectGoogleCalendar(activeSpaceId);
      const safeUrl = getSafeRedirectUrl(url);

      if (safeUrl) {
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
      }
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
  const preferences = preferencesQuery.data || null;
  const resolvedAppliedFilters = useMemo(
    () => ({
      spaceId: appliedFilters.spaceId.trim() || activeSpaceId || "",
      boardId: appliedFilters.boardId.trim() || activeBoardId || "",
      holidayCountry: appliedFilters.holidayCountry.trim() || preferences?.holidayCountry || "",
    }),
    [activeBoardId, activeSpaceId, appliedFilters.boardId, appliedFilters.holidayCountry, appliedFilters.spaceId, preferences?.holidayCountry],
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
  const shouldVirtualizeSelectedEvents = selectedDayEventsExpanded && selectedDayEvents.length > 24;
  const {
    handleScroll: handleSelectedEventVirtualScroll,
    measureViewport: measureSelectedEventViewport,
    totalHeight: selectedEventVirtualHeight,
    virtualItems: virtualSelectedEvents,
  } = useVirtualList(selectedDayEvents, { itemHeight: 74, overscan: 6 });
  const shouldVirtualizeNonWorkingEntries = nonWorkingEntries.length > 28;
  const {
    handleScroll: handleNonWorkingVirtualScroll,
    measureViewport: measureNonWorkingViewport,
    totalHeight: nonWorkingVirtualHeight,
    virtualItems: virtualNonWorkingEntries,
  } = useVirtualList(nonWorkingEntries, { itemHeight: 72, overscan: 6 });

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: t("calendar.title"), color: "text-slate-800", ref: "/calendar" },
    ]);
  }, [activeSpace?.name, setPath, t]);

  const pageError = preferencesQuery.isError
    ? preferencesQuery.error?.message || t("calendar.notices.preferencesFailed")
    : calendarEventsQuery.isError
      ? calendarEventsQuery.error?.message || t("calendar.notices.calendarFailed")
      : "";

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
    const nextFilters = {
      ...draftFilters,
      spaceId: activeSpaceId || "",
      boardId: activeBoardId || "",
    };
    setDraftFilters(nextFilters);
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

  const renderMonthView = () => (
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
              onClick={() => handleSelectDate(date)}
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

  const renderWeekView = () => (
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
            onClick={() => handleSelectDate(date)}
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

  const renderDayView = () => {
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
          {isNonWorkingDay ? <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">{t("calendar.labels.nonWorking")}</span> : null}
        </div>

        <div className="space-y-3">
          {dayEvents.length === 0 ? <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-4 text-[13px] text-slate-500">{t("calendar.labels.noEventsForDay")}</div> : null}
          {dayEvents.map((event) => (
            <article key={event.id} className={`rounded-[22px] px-4 py-4 ${eventClassName(event.type)}`}>
              <div className="text-[13px] font-semibold">{event.title}</div>
              {event.detail ? <div className="mt-1 text-[12px] opacity-80">{event.detail}</div> : null}
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-motion-calendar flex flex-1 flex-col overflow-hidden bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      <div className="shrink-0 border-b border-slate-200 bg-white px-5">
        <div className={`flex items-center gap-0 overflow-x-auto ${isRTL ? "flex-row-reverse" : ""}`}>
          {viewTabs.map((tab) => {
            const iconClassName = tab.icon.includes(" ") ? tab.icon : `fa-solid ${tab.icon}`;
            const content = (
              <>
                <i className={iconClassName} />
                <span>{tab.label}</span>
              </>
            );

            if (tab.to) {
              return (
                <Link
                  key={tab.label}
                  to={tab.to}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                    tab.active ? "border-sky-500 text-sky-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={tab.label}
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-medium text-slate-300"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className={`flex flex-wrap items-center gap-3 ${isRTL ? "xl:flex-row-reverse" : ""}`}>
                <button
                  type="button"
                  onClick={() => handleNavigate(-1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  <i className={`fa-solid ${isRTL ? "fa-chevron-right" : "fa-chevron-left"}`} />
                </button>
                <div className="min-w-[180px] text-[26px] font-black tracking-[-0.05em] text-slate-900">
                  {formatCalendarMonthLabel(anchorDate, locale, calendarSystem)}
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate(1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  <i className={`fa-solid ${isRTL ? "fa-chevron-left" : "fa-chevron-right"}`} />
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                >
                  {t("calendar.controls.today")}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyFilters()}
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
                      onClick={() => setCalendarSystem(system)}
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
                    onClick={() => handleChangeView(view)}
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

          {pageError ? (
            <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-600">{pageError}</div>
          ) : null}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.spaceId")}</label>
                    <input
                      value={draftFilters.spaceId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, spaceId: event.target.value }))}
                      placeholder={t("calendar.filters.workspaceScope")}
                      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.boardId")}</label>
                    <input
                      value={draftFilters.boardId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, boardId: event.target.value }))}
                      placeholder={t("calendar.filters.optionalBoardScope")}
                      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.holidayCountry")}</label>
                    <input
                      value={draftFilters.holidayCountry}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, holidayCountry: event.target.value.toUpperCase() }))}
                      placeholder={preferences?.holidayCountry || ""}
                      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] uppercase text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
                    />
                  </div>
                  <div className={`flex items-end gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="rounded-2xl bg-sky-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      {t("calendar.filters.apply")}
                    </button>
                    <button
                      type="button"
                      onClick={handleUseActiveWorkspace}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                    >
                      {t("calendar.filters.useActive")}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                    >
                      {t("calendar.filters.reset")}
                    </button>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
                  {t("calendar.notices.nonWorking")}
                </div>

                {invalidEventCount > 0 ? (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                    {invalidEventCount === 1
                      ? t("calendar.notices.invalidEntries", { count: invalidEventCount })
                      : t("calendar.notices.invalidEntriesPlural", { count: invalidEventCount })}
                  </div>
                ) : null}

                {initialCalendarLoading ? (
                  <CalendarBoardSkeleton />
                ) : (
                  <>
                    {calendarView === "month" ? renderMonthView() : null}
                    {calendarView === "week" ? renderWeekView() : null}
                    {calendarView === "day" ? renderDayView() : null}
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {legendItems.map((item) => (
                  <div key={item.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${item.className}`}>
                    <span className="h-2 w-2 rounded-full bg-current opacity-75" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-5">
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
                      onClick={() => setSelectedDayEventsExpanded((value) => !value)}
                      className="text-[12px] font-semibold text-sky-600 hover:text-sky-700"
                    >
                      {selectedDayEventsExpanded ? t("calendar.labels.showLess") : t("calendar.labels.showAllEvents", { count: selectedDayEvents.length })}
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className={`mb-3 flex items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.labels.nonWorkingDays")}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {t("calendar.labels.holidaysAndWeekends", {
                        country: draftFilters.holidayCountry || preferences?.holidayCountry || t("calendar.labels.noCountry"),
                      })}
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
                        {virtualNonWorkingEntries.map(({ item: entry, offsetTop }) => (
                          <div
                            key={`${entry.dateKey}-${entry.label}`}
                            className="absolute left-0 right-0 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5"
                            style={{ transform: `translateY(${offsetTop}px)`, minHeight: 64 }}
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
                        ))}
                      </div>
                    </div>
                  ) : (
                    nonWorkingEntries.map((entry) => (
                      <div key={`${entry.dateKey}-${entry.label}`} className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5">
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
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.google.title")}</div>
                <div className="space-y-3">
                  {googleStatusQuery.data?.connected ? (
                    <>
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[13px] font-semibold text-slate-700">{t("calendar.google.connected")}</span>
                      </div>
                      {googleStatusQuery.data?.lastSyncAt && (
                        <div className="text-[11px] text-slate-400">
                          {t("calendar.google.lastSynced", {
                            value: new Date(googleStatusQuery.data.lastSyncAt).toLocaleString(locale),
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleSyncGoogle}
                        disabled={isSyncing}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                      >
                        <i className={`fa-solid fa-arrows-rotate ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? t("calendar.google.syncing") : t("calendar.google.syncNow")}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-[12px] text-slate-500 leading-normal">
                        {t("calendar.google.connectDescription")}
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[12px] font-bold text-white hover:bg-indigo-700 transition"
                      >
                        <i className="fa-brands fa-google" />
                        {t("calendar.google.connectButton")}
                      </button>
                    </>
                  )}
                </div>
              </section>

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
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
