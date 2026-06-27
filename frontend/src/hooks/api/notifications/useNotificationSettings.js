import { useQuery } from "@tanstack/react-query";
import { getNotificationSettings } from "../../../services/api/notificationService";

export const useNotificationSettings = () => {
    return useQuery({
        queryKey: ["notification-settings"],
        queryFn: getNotificationSettings,
    });
};