import { useQuery } from "@tanstack/react-query";
import { fetchCalendarEvents, fetchCalendarPreferences } from "../lib/calendarApi";

export function useCalendarPreferencesQuery() {
  return useQuery({
    queryKey: ["calendar", "preferences"],
    queryFn: () => fetchCalendarPreferences(),
  });
}

export function useCalendarEventsQuery({ from, to, spaceId, boardId, holidayCountry, enabled = true }) {
  return useQuery({
    queryKey: ["calendar", "events", from, to, spaceId, boardId, holidayCountry],
    queryFn: () =>
      fetchCalendarEvents({
        from,
        to,
        spaceId,
        boardId,
        holidayCountry,
      }),
    enabled: enabled && Boolean(from) && Boolean(to),
  });
}
