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
    const response = await apiClient.patch("/notifications/read-all", {}, { params: { spaceId } });
    return response.data;
};

export const markAsRead = async (id, spaceId) => {
    const response = await apiClient.patch(`/notifications/${id}/read`, {}, { params: { spaceId } });
    return response.data;
};

export const deleteNotification = async (id, spaceId) => {
    const response = await apiClient.delete(`/notifications/${id}`, { params: { spaceId } });
    return response.data;
};

export const getTelegramUnlinkedChats = async (spaceId) => {
    const response = await apiClient.get(`/telegram/spaces/${spaceId}/unlinked-chats`);
    return response.data;
};

export const linkTelegramContact = async (spaceId, data) => {
    const response = await apiClient.post(`/telegram/spaces/${spaceId}/contact`, data);
    return response.data;
};

export const unlinkTelegramContact = async (spaceId) => {
    const response = await apiClient.post(`/telegram/spaces/${spaceId}/contact/opt-out`);
    return response.data;
};

export const requestWhatsAppOtp = async (spaceId, data) => {
    const response = await apiClient.post(`/whatsapp/spaces/${spaceId}/otp/request`, data);
    return response.data;
};

export const confirmWhatsAppOtp = async (spaceId, data) => {
    const response = await apiClient.post(`/whatsapp/spaces/${spaceId}/otp/confirm`, data);
    return response.data;
};

export const unlinkWhatsAppContact = async (spaceId) => {
    const response = await apiClient.post(`/whatsapp/spaces/${spaceId}/contact/opt-out`);
    return response.data;
};