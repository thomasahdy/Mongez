import { API_BASE_URL, apiRequest } from "./apiClient";

const normalizeDriveStatus = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return Boolean(payload.googleDriveConnected ?? payload.googleDrive ?? payload.connected);
};

const settledValue = (result) => (result.status === "fulfilled" ? result.value : null);

export function getGoogleDriveAuthUrl() {
  return `${API_BASE_URL}/integrations/google/auth`;
}

export async function disconnectGoogleDrive() {
  return apiRequest("/integrations/google", { method: "DELETE" });
}

export async function connectGoogleCalendar(spaceId) {
  return apiRequest("/calendar/google/connect", {
    method: "POST",
    params: { spaceId },
  });
}

export async function syncGoogleCalendar(spaceId) {
  return apiRequest("/calendar/google/sync", {
    method: "POST",
    params: { spaceId },
  });
}

export async function getIntegrationStatuses(spaceId) {
  const [driveResult, whatsappResult, telegramResult] = await Promise.allSettled([
    apiRequest("/integrations/status"),
    spaceId ? apiRequest(`/whatsapp/spaces/${spaceId}/status`) : Promise.resolve(null),
    spaceId ? apiRequest(`/telegram/spaces/${spaceId}/status`) : Promise.resolve(null),
  ]);

  const drive = settledValue(driveResult);

  return {
    googleDriveConnected: normalizeDriveStatus(drive),
    rawGoogleDrive: drive,
    whatsapp: settledValue(whatsappResult),
    telegram: settledValue(telegramResult),
  };
}
