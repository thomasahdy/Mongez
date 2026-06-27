import apiClient from "./apiClient";

export const getNotificationSettings = async () => {
    const response = await apiClient.get(
        "/notifications/settings"
    );

    return response.data;
};

export const updateNotificationChannel = async (
    id,
    channel,
    enabled
) => {
    const response = await apiClient.patch(
        `/notifications/settings/channels/${id}`,
        {
            channel,
            enabled,
        }
    );

    return response.data;
};

export const updateQuietHours = async (
    quietHours
) => {
    const response = await apiClient.patch(
        "/notifications/settings/quiet-hours",
        quietHours
    );

    return response.data;
};

export const resetNotificationSettings = async () => {
    const response = await apiClient.post(
        "/notifications/settings/reset"
    );

    return response.data;
};