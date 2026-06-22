import { apiRequest } from "./apiClient";

export async function fetchCalendarEvents(params) {
  const { from, to, signal, ...rest } = params || {};
  return apiRequest("/calendar/events", {
    params: {
      ...rest,
      startDate: rest.startDate || from,
      endDate: rest.endDate || to,
    },
    signal,
  });
}

export async function fetchCalendarPreferences() {
  return apiRequest("/users/me/preferences");
}
