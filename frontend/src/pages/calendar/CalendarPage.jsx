import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { addNonWorkingDay, fetchCalendarEvents, fetchNonWorkingDays, removeNonWorkingDay } from "../../lib/calendarApi";

const breadcrumbPath = [
  { name: "Al-Noor Foundation", color: "text-slate-400", ref: "" },
  { name: "Calendar", color: "text-slate-800", ref: "" },
];

const STORAGE_KEY = "mongez.calendar.filters";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_VIEWS = ["month", "week", "day"];

const buildViewTabs = (boardId) => [
  { label: "Board", icon: "fa-table-columns", to: boardId ? `/board/${boardId}` : "/app" },
  { label: "List", icon: "fa-list", to: boardId ? `/board/${boardId}/list` : "/app" },
  { label: "Calendar", icon: "fa-regular fa-calendar", to: "/calendar", active: true },
  { label: "Gantt", icon: "fa-bars-staggered", to: boardId ? `/board/${boardId}/timeline` : "/app" },
  { label: "Table", icon: "fa-table-cells", to: boardId ? `/board/${boardId}/table` : "/app" },
];

const legendItems = [
  { label: "Task", className: "bg-sky-100 text-sky-700 border-sky-200" },
  { label: "Deadline", className: "bg-rose-100 text-rose-700 border-rose-200" },
  { label: "Meeting", className: "bg-violet-100 text-violet-700 border-violet-200" },
  { label: "Milestone", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "Non-working", className: "bg-slate-200 text-slate-700 border-slate-300" },
];

function readFilters() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : { spaceId: "", boardId: "" };
  } catch {
    return { spaceId: "", boardId: "" };
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

function getYearsInRange(start, end) {
  const years = new Set();
  let currentDate = new Date(start);

  while (currentDate <= end) {
    years.add(currentDate.getFullYear());
    currentDate = addDays(currentDate, 32);
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }

  years.add(end.getFullYear());
  return [...years];
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

  return rawEvents
    .map((event, index) => {
      const startValue = event.start || event.startDate || event.date || event.dueDate || event.datetime;
      const endValue = event.end || event.endDate || event.date || event.dueDate || startValue;

      if (!startValue) {
        return null;
      }

      const startDate = startOfDay(new Date(startValue));
      const endDate = startOfDay(new Date(endValue));
      const title = event.title || event.name || event.taskTitle || event.taskName || `Event ${index + 1}`;
      const rawType = `${event.type || ""} ${event.category || ""} ${event.status || ""} ${title}`.toLowerCase();

      let type = "task";
      if (rawType.includes("complete") || rawType.includes("done")) {
        type = "done";
      } else if (rawType.includes("deadline") || rawType.includes("due")) {
        type = "deadline";
      } else if (rawType.includes("meeting") || rawType.includes("call") || rawType.includes("standup")) {
        type = "meeting";
      } else if (rawType.includes("milestone")) {
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
}

function normalizeNonWorkingDays(payload) {
  const rawDays = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.days)
        ? payload.days
        : Array.isArray(payload?.nonWorkingDays)
          ? payload.nonWorkingDays
          : [];

  return rawDays
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      return item?.date || item?.day || item?.value || "";
    })
    .filter(Boolean);
}

function eventClassName(type) {
  switch (type) {
    case "deadline":
      return "border border-rose-200 bg-rose-50 text-rose-700";
    case "meeting":
      return "border border-violet-200 bg-violet-50 text-violet-700";
    case "milestone":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    case "done":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border border-sky-200 bg-sky-50 text-sky-700";
  }
}

function getNavTargetDate(anchorDate, view, direction) {
  if (view === "month") {
    return addMonths(anchorDate, direction);
  }

  return addDays(anchorDate, direction * (view === "week" ? 7 : 1));
}

function CalendarPage() {
  const { setPath, activeBoard } = useOutletContext();
  const viewTabs = buildViewTabs(activeBoard?.id);
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarView, setCalendarView] = useState("month");
  const [draftFilters, setDraftFilters] = useState(readFilters);
  const [appliedFilters, setAppliedFilters] = useState(readFilters);
  const [events, setEvents] = useState([]);
  const [nonWorkingDays, setNonWorkingDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [nonWorkingDateInput, setNonWorkingDateInput] = useState(() => formatDateKey(startOfDay(new Date())));
  const [nonWorkingBusy, setNonWorkingBusy] = useState(false);
  const [selectedDayEventsExpanded, setSelectedDayEventsExpanded] = useState(false);
  const requestAbortRef = useRef(null);
  const hasInitializedRef = useRef(false);

  const visibleRange = useMemo(() => getVisibleRange(anchorDate, calendarView), [anchorDate, calendarView]);
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

  const nonWorkingDaySet = useMemo(() => new Set(nonWorkingDays), [nonWorkingDays]);

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];

  useEffect(() => {
    setPath?.(breadcrumbPath);
  }, [setPath]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appliedFilters));
    } catch {
      // Ignore persistence issues.
    }
  }, [appliedFilters]);

  const loadCalendarData = async ({ nextAnchorDate, nextView, nextFilters, nextSelectedDate }) => {
    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    setLoading(true);
    setPageError("");

    const nextRange = getVisibleRange(nextAnchorDate, nextView);
    const years = getYearsInRange(nextRange.start, nextRange.end);

    try {
      const [eventsPayload, ...nonWorkingPayloads] = await Promise.all([
        fetchCalendarEvents({
          from: formatDateKey(nextRange.start),
          to: formatDateKey(nextRange.end),
          spaceId: nextFilters.spaceId.trim(),
          boardId: nextFilters.boardId.trim(),
          signal: abortController.signal,
        }),
        ...years.map((year) => fetchNonWorkingDays({ year, signal: abortController.signal })),
      ]);

      if (abortController.signal.aborted) {
        return;
      }

      const mergedNonWorkingDays = [...new Set(nonWorkingPayloads.flatMap((payload) => normalizeNonWorkingDays(payload)))];

      setAnchorDate(nextAnchorDate);
      setCalendarView(nextView);
      setSelectedDate(nextSelectedDate);
      setEvents(normalizeEvents(eventsPayload));
      setNonWorkingDays(mergedNonWorkingDays);
      setAppliedFilters(nextFilters);
    } catch (error) {
      if (!abortController.signal.aborted) {
        setPageError(error.message || "Failed to load the calendar.");
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (hasInitializedRef.current) {
      return undefined;
    }

    hasInitializedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void loadCalendarData({
        nextAnchorDate: anchorDate,
        nextView: calendarView,
        nextFilters: appliedFilters,
        nextSelectedDate: selectedDate,
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [anchorDate, appliedFilters, calendarView, selectedDate]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  const handleNavigate = (direction) => {
    const nextAnchorDate = getNavTargetDate(anchorDate, calendarView, direction);
    const nextSelectedDate = calendarView === "month" ? startOfMonth(nextAnchorDate) : startOfDay(nextAnchorDate);

    void loadCalendarData({
      nextAnchorDate,
      nextView: calendarView,
      nextFilters: appliedFilters,
      nextSelectedDate,
    });
  };

  const handleGoToToday = () => {
    const today = startOfDay(new Date());

    void loadCalendarData({
      nextAnchorDate: today,
      nextView: calendarView,
      nextFilters: appliedFilters,
      nextSelectedDate: today,
    });
  };

  const handleChangeView = (nextView) => {
    const normalizedView = CALENDAR_VIEWS.includes(nextView) ? nextView : "month";
    const nextSelectedDate = normalizedView === "month" ? startOfMonth(anchorDate) : startOfDay(anchorDate);

    void loadCalendarData({
      nextAnchorDate: anchorDate,
      nextView: normalizedView,
      nextFilters: appliedFilters,
      nextSelectedDate,
    });
  };

  const handleApplyFilters = () => {
    void loadCalendarData({
      nextAnchorDate: anchorDate,
      nextView: calendarView,
      nextFilters: draftFilters,
      nextSelectedDate: selectedDate,
    });
  };

  const handleSelectDate = (date) => {
    setSelectedDate(startOfDay(date));
    setNonWorkingDateInput(formatDateKey(date));
    setSelectedDayEventsExpanded(false);
  };

  const handleRefresh = () => {
    void loadCalendarData({
      nextAnchorDate: anchorDate,
      nextView: calendarView,
      nextFilters: appliedFilters,
      nextSelectedDate: selectedDate,
    });
  };

  const handleAddNonWorkingDay = async () => {
    if (!nonWorkingDateInput) {
      return;
    }

    setNonWorkingBusy(true);
    setPageError("");

    try {
      await addNonWorkingDay({ date: nonWorkingDateInput });
      await loadCalendarData({
        nextAnchorDate: anchorDate,
        nextView: calendarView,
        nextFilters: appliedFilters,
        nextSelectedDate: selectedDate,
      });
    } catch (error) {
      setPageError(error.message || "Failed to add the non-working day.");
    } finally {
      setNonWorkingBusy(false);
    }
  };

  const handleRemoveNonWorkingDay = async (date) => {
    setNonWorkingBusy(true);
    setPageError("");

    try {
      await removeNonWorkingDay({ date });
      await loadCalendarData({
        nextAnchorDate: anchorDate,
        nextView: calendarView,
        nextFilters: appliedFilters,
        nextSelectedDate: selectedDate,
      });
    } catch (error) {
      setPageError(error.message || "Failed to remove the non-working day.");
    } finally {
      setNonWorkingBusy(false);
    }
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
              className={`min-h-[138px] border-b border-r border-slate-200 p-2.5 text-left align-top transition-colors last:border-r-0 hover:bg-slate-50 ${
                isOtherMonth ? "bg-slate-50/60 text-slate-300" : "bg-white"
              } ${isSelected ? "bg-sky-50/70" : ""} ${isNonWorkingDay ? "bg-slate-100/80" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-semibold ${
                    isToday ? "bg-sky-500 text-white" : "text-slate-700"
                  }`}
                >
                  {date.getDate()}
                </span>
                {isNonWorkingDay && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Off</span>}
              </div>

              <div className="space-y-1.5">
                {dateEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className={`truncate rounded-lg px-2 py-1 text-[11px] font-medium ${eventClassName(event.type)}`}>
                    {event.type === "done" ? "[Done] " : event.type === "deadline" ? "[Due] " : event.type === "milestone" ? "[Milestone] " : ""}
                    {event.title}
                  </div>
                ))}
                {dateEvents.length > 3 && (
                  <div className="px-1 text-[10px] font-semibold text-slate-400">+{dateEvents.length - 3} more</div>
                )}
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
        const isToday = isSameDay(date, new Date());
        const isNonWorkingDay = nonWorkingDaySet.has(dateKey);

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => handleSelectDate(date)}
            className={`min-h-[340px] rounded-[24px] border p-4 text-left shadow-[0_16px_35px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 ${
              isToday ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"
            } ${isNonWorkingDay ? "bg-slate-100/80" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{WEEKDAY_LABELS[date.getDay()]}</div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-slate-900">{date.getDate()}</div>
              </div>
              {isNonWorkingDay && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Non-working</span>}
            </div>

            <div className="space-y-2">
              {dateEvents.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-400">No events</div>}
              {dateEvents.map((event) => (
                <div key={event.id} className={`rounded-2xl px-3 py-2.5 text-[12px] font-medium leading-5 ${eventClassName(event.type)}`}>
                  <div>{event.title}</div>
                  {event.detail && <div className="mt-1 text-[11px] opacity-80">{event.detail}</div>}
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
          {isNonWorkingDay && <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">Non-working day</span>}
        </div>

        <div className="space-y-3">
          {dayEvents.length === 0 && <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-4 text-[13px] text-slate-500">No events for this day.</div>}
          {dayEvents.map((event) => (
            <article key={event.id} className={`rounded-[22px] px-4 py-4 ${eventClassName(event.type)}`}>
              <div className="text-[13px] font-semibold">{event.title}</div>
              {event.detail && <div className="mt-1 text-[12px] opacity-80">{event.detail}</div>}
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
                  onClick={handleRefresh}
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

          {pageError && (
            <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-600">{pageError}</div>
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex flex-col gap-4 lg:flex-row">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Space ID</label>
                    <input
                      value={draftFilters.spaceId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, spaceId: event.target.value }))}
                      placeholder="Optional filter for /events"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Board ID</label>
                    <input
                      value={draftFilters.boardId}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, boardId: event.target.value }))}
                      placeholder="Optional filter for /events"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="rounded-2xl bg-sky-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-600"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>

                {calendarView === "month" && renderMonthView()}
                {calendarView === "week" && renderWeekView()}
                {calendarView === "day" && renderDayView()}
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
                  {selectedDayEvents.length === 0 && (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">No events on this day.</div>
                  )}

                  {(selectedDayEventsExpanded ? selectedDayEvents : selectedDayEvents.slice(0, 4)).map((event) => (
                    <article key={event.id} className={`rounded-[22px] px-3.5 py-3 ${eventClassName(event.type)}`}>
                      <div className="text-[12px] font-semibold">{event.title}</div>
                      {event.detail && <div className="mt-1 text-[11px] opacity-80">{event.detail}</div>}
                    </article>
                  ))}

                  {selectedDayEvents.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDayEventsExpanded((value) => !value)}
                      className="text-[12px] font-semibold text-sky-600 hover:text-sky-700"
                    >
                      {selectedDayEventsExpanded ? "Show less" : `Show all ${selectedDayEvents.length} events`}
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Non-Working Days</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={nonWorkingDateInput}
                    onChange={(event) => setNonWorkingDateInput(event.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddNonWorkingDay}
                    disabled={nonWorkingBusy}
                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {nonWorkingDays.length === 0 && (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-3 text-[12px] leading-5 text-slate-500">
                      No non-working days returned for the visible year range.
                    </div>
                  )}

                  {nonWorkingDays
                    .slice()
                    .sort()
                    .map((date) => (
                      <div key={date} className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <span className="flex-1 text-[12px] font-medium text-slate-700">{date}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNonWorkingDay(date)}
                          disabled={nonWorkingBusy}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Remove non-working day ${date}`}
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

export default CalendarPage;
