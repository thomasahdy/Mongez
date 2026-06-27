import apiClient from "./apiClient";

export const getNotificationSettings = async () => {
    const response = await apiClient.get(
        "/api/v1/notifications/settings"
    );

    return response.data.data;
};

export const updateNotificationChannel = async (
    id,
    channel,
    enabled
) => {
    const response = await apiClient.patch(
        `/api/v1/notifications/settings/channels/${id}`,
        {
            channel,
            enabled,
        }
    );

    return response.data.data;
};

export const updateQuietHours = async (
    quietHours
) => {
    const response = await apiClient.patch(
        "/api/v1/notifications/settings/quiet-hours",
        quietHours
    );

    return response.data.data;
};

export const resetNotificationSettings = async () => {
    const response = await apiClient.post(
        "/api/v1/notifications/settings/reset"
    );

    return response.data.data;
};