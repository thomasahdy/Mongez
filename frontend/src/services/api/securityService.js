// contains API calls
import apiClient from './apiClient';

export const changePassword = async (currentPassword, newPassword) => {
    const response = await apiClient.patch("/users/me/password",
        {
            currentPassword,
            newPassword,
        }
    );

    return response.data;
}

export const get2FAStatus = async () => {
    const response = await apiClient.get("/auth/2fa/status");
    return response.data.data;
};

export const enable2FA = async () => {
    const response = await apiClient.post("/auth/2fa/enable");
    return response.data.data;
};

export const verify2FA = async (code) => {
    const response = await apiClient.post("/auth/2fa/verify", { code });
    return response.data.data;
};

export const disable2FA = async (code) => {
    const response = await apiClient.post("/auth/2fa/disable", { code });
    return response.data.data;
};

export const getSessions = async () => {
    const response = await apiClient.get("/auth/sessions");
    return response.data.data;
};


export const terminateSession = async (sessionId) => {
    const response = await apiClient.delete(`/auth/sessions/${sessionId}`);
    
    return response.data;
};

export const terminateAllSessions = async () => {
    const response = await apiClient.delete("/auth/sessions");

    return response.data;
};

export const getSessionSettings = async () => {
    const response = await apiClient.get("/users/me/session-settings");
    return response.data.data;
};

export const updateSessionSettings = async (settings) => {
    const response = await apiClient.patch("/users/me/session-settings", settings);
    return response.data.data;
};