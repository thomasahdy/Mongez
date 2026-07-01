import { readStorageJson, readStorageValue } from "../../utils/browserStorage";

export const STORAGE_KEY = "mongez.calendar.filters";
export const CALENDAR_SYSTEM_STORAGE_KEY = "mongez.calendar.system";
export const CALENDAR_VIEWS = ["month", "week", "day"];
export const CALENDAR_SYSTEMS = ["gregory", "islamic"];
export const NON_WORKING_WEEKEND = "weekend";

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

export function getSafeRedirectUrl(rawUrl) {
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

export function readFilters(activeSpaceId, activeBoardId) {
  const parsed = readStorageJson(STORAGE_KEY, {});
  return {
    spaceId: parsed.spaceId || activeSpaceId || "",
    boardId: parsed.boardId || activeBoardId || "",
    holidayCountry: parsed.holidayCountry || "",
  };
}

export function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return startOfDay(nextDate);
}

export function addMonths(date, amount) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + amount);
  return startOfDay(nextDate);
}

export function startOfWeek(date) {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLongDayLabel(date, locale) {
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

export function readCalendarSystem(language) {
  const storedValue = readStorageValue(CALENDAR_SYSTEM_STORAGE_KEY, "");
  if (storedValue && CALENDAR_SYSTEMS.includes(storedValue)) {
    return storedValue;
  }

  return String(language || "").startsWith("ar") ? "islamic" : "gregory";
}

export function getCalendarLocale(locale, calendarSystem) {
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

export function getMonthRange(date, locale, calendarSystem) {
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

export function addCalendarMonths(date, amount, locale, calendarSystem) {
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

export function formatCalendarMonthLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatCalendarLongDayLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatCalendarWeekdayLabel(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    weekday: "short",
  }).format(date);
}

export function formatCalendarDayNumber(date, locale, calendarSystem) {
  return new Intl.DateTimeFormat(getCalendarLocale(locale, calendarSystem), {
    day: "numeric",
  }).format(date);
}

export function isSameDay(left, right) {
  return formatDateKey(left) === formatDateKey(right);
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function getVisibleRange(anchorDate, view) {
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

export function getNavTargetDate(anchorDate, view, direction) {
  if (view === "month") {
    return addMonths(anchorDate, direction);
  }

  return addDays(anchorDate, direction * (view === "week" ? 7 : 1));
}

export function eventClassName(type) {
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

export function buildViewTabs(boardId, t) {
  return [
    { label: t("calendar.viewTabs.board"), icon: "fa-table-columns" },
    { label: t("calendar.viewTabs.list"), icon: "fa-list" },
    { label: t("calendar.viewTabs.calendar"), icon: "fa-regular fa-calendar", to: "/calendar", active: true },
    { label: t("calendar.viewTabs.gantt"), icon: "fa-bars-staggered", to: boardId ? `/board/${boardId}/timeline` : "" },
    { label: t("calendar.viewTabs.table"), icon: "fa-table-cells", to: boardId ? `/board/${boardId}/table` : "" },
  ];
}

export function normalizeEvents(payload, t) {
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

export function buildNonWorkingEntries(visibleDates, eventsByDate, selectedCountry) {
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
