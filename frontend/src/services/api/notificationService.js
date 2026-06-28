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

export const getNotifications = async (params = {}) => {
    const response = await apiClient.get("/notifications", { params });
    return response.data;
};

export const getUnreadCount = async (spaceId) => {
    const response = await apiClient.get("/notifications/unread-count", { params: { spaceId } });
    return response.data;
};

export const markAllAsRead = async (spaceId) => {
    const response = await apiClient.patch("/notifications/read-all", null, { params: { spaceId } });
    return response.data;
};

export const markAsRead = async (id, spaceId) => {
    const response = await apiClient.patch(`/notifications/${id}/read`, null, { params: { spaceId } });
    return response.data;
};

export const deleteNotification = async (id, spaceId) => {
    const response = await apiClient.delete(`/notifications/${id}`, { params: { spaceId } });
    return response.data;
};