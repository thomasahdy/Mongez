import apiClient from "./apiClient";

const timeLabels = {
    "20:00": "8:00 PM",
    "21:00": "9:00 PM",
    "22:00": "10:00 PM",
    "23:00": "11:00 PM",
    "07:00": "7:00 AM",
    "08:00": "8:00 AM",
    "09:00": "9:00 AM",
};

const normalizeQuietHours = (quietHours = {}) => ({
    ...quietHours,
    startTime: timeLabels[quietHours.startTime] ?? quietHours.startTime ?? "11:00 PM",
    endTime: timeLabels[quietHours.endTime] ?? quietHours.endTime ?? "7:00 AM",
});

export const getNotificationSettings = async () => {
    const response = await apiClient.get(
        "/notifications/settings"
    );

    const settings = response.data?.data ?? response.data;
    return {
        ...settings,
        quietHours: normalizeQuietHours(settings?.quietHours),
    };
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
