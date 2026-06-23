import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";
import {
  useCalendarEventsQuery,
  useCalendarPreferencesQuery,
} from "../../hooks/useCalendarQueries";

const STORAGE_KEY = "mongez.calendar.filters";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_VIEWS = ["month", "week", "day"];

const legendItems = [
  { label: "Task", className: "bg-sky-100 text-sky-700 border-sky-200" },
  { label: "Deadline", className: "bg-rose-100 text-rose-700 border-rose-200" },
  { label: "Meeting", className: "bg-violet-100 text-violet-700 border-violet-200" },
  { label: "Milestone", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "Holiday", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "Weekend", className: "bg-slate-200 text-slate-700 border-slate-300" },
];

function readFilters(activeSpaceId, activeBoardId) {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    return {
      spaceId: parsed.spaceId || activeSpaceId || "",
      boardId: parsed.boardId || activeBoardId || "",
      holidayCountry: parsed.holidayCountry || "",
    };
  } catch {
    return {
      spaceId: activeSpaceId || "",
      boardId: activeBoardId || "",
      holidayCountry: "",
    };
  }
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

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLongDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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

function buildViewTabs(boardId) {
  return [
    { label: "Board", icon: "fa-table-columns" },
    { label: "List", icon: "fa-list" },
    { label: "Calendar", icon: "fa-regular fa-calendar", to: "/calendar", active: true },
    { label: "Gantt", icon: "fa-bars-staggered", to: boardId ? `/board/${boardId}/timeline` : "" },
    { label: "Table", icon: "fa-table-cells", to: boardId ? `/board/${boardId}/table` : "" },
  ];
}

function normalizeEvents(payload) {
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
      const title = event.title || event.name || event.taskTitle || event.taskName || `Event ${index + 1}`;
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
        label: holiday ? holiday.title : "Weekend",
        source: holiday ? selectedCountry : "Weekend",
      };
    });
}

export default function CalendarPage() {
  const { setPath, activeBoard: outletBoard } = useOutletContext() || {};
  const { activeSpace, activeSpaceId, activeBoard, activeBoardId, user } = useAppContext();
  const resolvedBoard = outletBoard || activeBoard;
  const viewTabs = buildViewTabs(resolvedBoard?.id || activeBoardId);
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarView, setCalendarView] = useState("month");
  const [draftFilters, setDraftFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [appliedFilters, setAppliedFilters] = useState(() => readFilters(activeSpaceId, activeBoardId));
  const [pageError, setPageError] = useState("");
  const [selectedDayEventsExpanded, setSelectedDayEventsExpanded] = useState(false);
  const preferencesQuery = useCalendarPreferencesQuery();

  const visibleRange = useMemo(() => getVisibleRange(anchorDate, calendarView), [anchorDate, calendarView]);
  const preferences = preferencesQuery.data || null;
  const calendarEventsQuery = useCalendarEventsQuery({
    from: formatDateKey(visibleRange.start),
    to: formatDateKey(visibleRange.end),
    spaceId: appliedFilters.spaceId.trim(),
    boardId: appliedFilters.boardId.trim(),
    holidayCountry: appliedFilters.holidayCountry.trim() || preferences?.holidayCountry || "",
    enabled: Boolean(visibleRange.start && visibleRange.end),
  });
  const normalizedEvents = useMemo(() => normalizeEvents(calendarEventsQuery.data), [calendarEventsQuery.data]);
  const events = normalizedEvents.items;
  const invalidEventCount = normalizedEvents.invalidCount;
  const loading = calendarEventsQuery.isLoading || calendarEventsQuery.isFetching;

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
    () => buildNonWorkingEntries(visibleDates, eventsByDate, appliedFilters.holidayCountry || preferences?.holidayCountry || ""),
    [appliedFilters.holidayCountry, eventsByDate, preferences?.holidayCountry, visibleDates],
  );
  const nonWorkingDaySet = useMemo(() => new Set(nonWorkingEntries.map((entry) => entry.dateKey)), [nonWorkingEntries]);

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: "Calendar", color: "text-slate-800", ref: "/calendar" },
    ]);
  }, [activeSpace?.name, setPath]);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    setDraftFilters((current) => ({
      ...current,
      holidayCountry: current.holidayCountry || preferences.holidayCountry || "",
      spaceId: current.spaceId || activeSpaceId || "",
      boardId: current.boardId || activeBoardId || "",
    }));
    setAppliedFilters((current) => ({
      ...current,
      holidayCountry: current.holidayCountry || preferences.holidayCountry || "",
      spaceId: current.spaceId || activeSpaceId || "",
      boardId: current.boardId || activeBoardId || "",
    }));
  }, [activeBoardId, activeSpaceId, preferences]);

  useEffect(() => {
    if (preferencesQuery.isError) {
      setPageError(preferencesQuery.error?.message || "Unable to load calendar preferences.");
      return;
    }

    if (calendarEventsQuery.isError) {
      setPageError(calendarEventsQuery.error?.message || "Failed to load the calendar.");
      return;
    }

    setPageError("");
  }, [
    calendarEventsQuery.error?.message,
    calendarEventsQuery.isError,
    preferencesQuery.error?.message,
    preferencesQuery.isError,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appliedFilters));
    } catch {
      // Ignore persistence issues.
    }
  }, [appliedFilters]);

  const handleNavigate = (direction) => {
    const nextAnchorDate = getNavTargetDate(anchorDate, calendarView, direction);
    const nextSelectedDate = calendarView === "month" ? startOfMonth(nextAnchorDate) : startOfDay(nextAnchorDate);
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
    const nextSelectedDate = normalizedView === "month" ? startOfMonth(anchorDate) : startOfDay(anchorDate);
    setCalendarView(normalizedView);
    setSelectedDate(nextSelectedDate);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
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
        {WEEKDAY_LABELS.map((label) => (
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

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleSelectDate(date)}
              className={`min-h-[138px] border-b border-r border-slate-200 p-2.5 text-left transition-colors last:border-r-0 hover:bg-slate-50 ${
                isOtherMonth ? "bg-slate-50/60 text-slate-300" : "bg-white"
              } ${isSelected ? "bg-sky-50/70" : ""} ${isNonWorkingDay ? "bg-slate-100/75" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-semibold ${
                    isToday ? "bg-sky-500 text-white" : "text-slate-700"
                  }`}
                >
                  {date.getDate()}
                </span>
                {isNonWorkingDay ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    Off
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
                  <div className="px-1 text-[10px] font-semibold text-slate-400">+{dateEvents.length - 3} more</div>
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
            className={`min-h-[340px] rounded-[24px] border p-4 text-left shadow-[0_16px_35px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 ${
              today ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"
            } ${isNonWorkingDay ? "bg-slate-100/75" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{WEEKDAY_LABELS[date.getDay()]}</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-slate-900">{date.getDate()}</div>
              </div>
              {isNonWorkingDay ? (
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  Non-working
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              {dateEvents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-400">No events</div> : null}
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
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Day View</div>
            <h2 className="mt-1 text-[26px] font-black tracking-[-0.05em] text-slate-900">{formatLongDayLabel(selectedDate)}</h2>
          </div>
          {isNonWorkingDay ? <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">Non-working day</span> : null}
        </div>

        <div className="space-y-3">
          {dayEvents.length === 0 ? <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-4 text-[13px] text-slate-500">No events for this day.</div> : null}
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
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-0 overflow-x-auto">
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
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate(-1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <div className="min-w-[180px] text-[26px] font-black tracking-[-0.05em] text-slate-900">{formatMonthLabel(anchorDate)}</div>
                <button
                  type="button"
                  onClick={() => handleNavigate(1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyFilters()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                >
                  <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-rotate-right"} mr-2`} />
                  Refresh
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                    {view}
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
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Space ID</label>
                    <input
                      value={draftFilters.spaceId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, spaceId: event.target.value }))}
                      placeholder="Workspace scope"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Board ID</label>
                    <input
                      value={draftFilters.boardId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, boardId: event.target.value }))}
                      placeholder="Optional board scope"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Holiday country</label>
                    <input
                      value={draftFilters.holidayCountry}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, holidayCountry: event.target.value.toUpperCase() }))}
                      placeholder={preferences?.holidayCountry || ""}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] uppercase text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="rounded-2xl bg-sky-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={handleUseActiveWorkspace}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                    >
                      Use active
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
                  Non-working days are now derived from the backend calendar feed plus visible weekends. No frontend-only add/remove stubs are used here anymore.
                </div>

                {invalidEventCount > 0 ? (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
                    {invalidEventCount} calendar entr{invalidEventCount === 1 ? "y was" : "ies were"} skipped because the backend payload did not include a usable date.
                  </div>
                ) : null}

                {calendarView === "month" ? renderMonthView() : null}
                {calendarView === "week" ? renderWeekView() : null}
                {calendarView === "day" ? renderDayView() : null}
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
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Selected Day</div>
                <h2 className="text-[22px] font-black tracking-[-0.04em] text-slate-900">{formatLongDayLabel(selectedDate)}</h2>
                <div className="mt-4 space-y-2">
                  {selectedDayEvents.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">No events on this day.</div>
                  ) : null}

                  {(selectedDayEventsExpanded ? selectedDayEvents : selectedDayEvents.slice(0, 4)).map((event) => (
                    <article key={event.id} className={`rounded-[22px] px-3.5 py-3 ${eventClassName(event.type)}`}>
                      <div className="text-[12px] font-semibold">{event.title}</div>
                      {event.detail ? <div className="mt-1 text-[11px] opacity-80">{event.detail}</div> : null}
                    </article>
                  ))}

                  {selectedDayEvents.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDayEventsExpanded((value) => !value)}
                      className="text-[12px] font-semibold text-sky-600 hover:text-sky-700"
                    >
                      {selectedDayEventsExpanded ? "Show less" : `Show all ${selectedDayEvents.length} events`}
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Non-Working Days</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {(draftFilters.holidayCountry || preferences?.holidayCountry || "No country")} holidays and visible weekends
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                    {nonWorkingEntries.length} in range
                  </div>
                </div>

                <div className="space-y-2">
                  {nonWorkingEntries.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">
                      No non-working days were returned for the current visible range.
                    </div>
                  ) : null}

                  {nonWorkingEntries.map((entry) => (
                    <div key={`${entry.dateKey}-${entry.label}`} className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className="text-[12px] font-semibold text-slate-700">{entry.dateKey}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {entry.label} | {entry.source}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Calendar Scope</div>
                <div className="mt-3 space-y-2 text-[13px] text-slate-500">
                  <div>
                    Workspace: <span className="font-semibold text-slate-700">{activeSpace?.name || draftFilters.spaceId || "Not selected"}</span>
                  </div>
                  <div>
                    Board: <span className="font-semibold text-slate-700">{resolvedBoard?.name || draftFilters.boardId || "All boards"}</span>
                  </div>
                  <div>
                    Timezone: <span className="font-semibold text-slate-700">{preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                  </div>
                  <div>
                    Viewer: <span className="font-semibold text-slate-700">{user?.email || user?.name || "Current user"}</span>
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
