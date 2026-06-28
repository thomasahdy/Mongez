import apiClient from "./apiClient";

export const fetchCalendarEvents = async (params = {}) => {
  const { from, to, startDate, endDate, ...rest } = params;
  const response = await apiClient.get("/calendar/events", {
    params: {
      ...rest,
      startDate: startDate || from,
      endDate: endDate || to,
    },
  });
  return response.data;
};

export const fetchCalendarPreferences = async () => {
  const response = await apiClient.get("/users/me/preferences");
  return response.data;
};

export const connectGoogleCalendar = async (spaceId) => {
  const response = await apiClient.post("/calendar/google/connect", null, {
    params: { spaceId },
  });
  return response.data;
};

export const syncGoogleCalendar = async (spaceId) => {
  const response = await apiClient.post("/calendar/google/sync", null, {
    params: { spaceId },
  });
  return response.data;
};

export const getGoogleSyncStatus = async (spaceId) => {
  const response = await apiClient.get("/calendar/google/status", {
    params: { spaceId },
  });
  return response.data;
};

const calendarService = {
  fetchCalendarEvents,
  fetchCalendarPreferences,
  connectGoogleCalendar,
  syncGoogleCalendar,
  getGoogleSyncStatus,
};

export default calendarService;
