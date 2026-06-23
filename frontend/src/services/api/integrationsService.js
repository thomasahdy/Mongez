import { API_BASE_URL } from "./apiClient";
import apiClient from "./apiClient";

const normalizeDriveStatus = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return Boolean(payload.googleDriveConnected ?? payload.googleDrive ?? payload.connected);
};

const settledValue = (result) => (result.status === "fulfilled" ? result.value.data ?? result.value : null);

export const getGoogleDriveAuthUrl = () => `${API_BASE_URL}/integrations/google/auth`;

export const disconnectGoogleDrive = async () => {
  const response = await apiClient.delete("/integrations/google");
  return response.data;
};

export const getIntegrationStatuses = async (spaceId) => {
  const [driveResult, whatsappResult, telegramResult] = await Promise.allSettled([
    apiClient.get("/integrations/status"),
    spaceId ? apiClient.get(`/whatsapp/spaces/${spaceId}/status`) : Promise.resolve(null),
    spaceId ? apiClient.get(`/telegram/spaces/${spaceId}/status`) : Promise.resolve(null),
  ]);

  const drive = settledValue(driveResult);

  return {
    googleDriveConnected: normalizeDriveStatus(drive),
    rawGoogleDrive: drive,
    whatsapp: settledValue(whatsappResult),
    telegram: settledValue(telegramResult),
  };
};

const integrationsService = {
  getGoogleDriveAuthUrl,
  disconnectGoogleDrive,
  getIntegrationStatuses,
};

export default integrationsService;
