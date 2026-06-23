import { useQuery } from "@tanstack/react-query";
import calendarService from "../services/api/calendarService";

export function useCalendarPreferencesQuery() {
  return useQuery({
    queryKey: ["calendar", "preferences"],
    queryFn: () => calendarService.fetchCalendarPreferences(),
  });
}

export function useCalendarEventsQuery({ from, to, spaceId, boardId, holidayCountry, enabled = true }) {
  return useQuery({
    queryKey: ["calendar", "events", from, to, spaceId, boardId, holidayCountry],
    queryFn: () =>
      calendarService.fetchCalendarEvents({
        from,
        to,
        spaceId,
        boardId,
        holidayCountry,
      }),
    enabled: enabled && Boolean(from) && Boolean(to),
  });
}
