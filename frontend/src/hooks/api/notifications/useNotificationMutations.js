import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateNotificationChannel, updateQuietHours, resetNotificationSettings } from "../../../services/api/notificationService";

export const useNotificationMutations = () => {
    const queryClient = useQueryClient();

    const updateChannelMutation = useMutation({
        mutationFn: ({id, channel, enabled }) => 
            updateNotificationChannel(id, channel, enabled),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["notification-settings"],
            });
        },
    });

    const updateQuietHoursMutation = useMutation({
        mutationFn: updateQuietHours,
        
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["notification-settings"],
            });
        },
    });

    const resetSettingsMutation = useMutation({
        mutationFn: resetNotificationSettings,
        
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["notification-settings"],
            });
        },
    });


    return {
    updateChannel: updateChannelMutation.mutate,
    updateChannelAsync: updateChannelMutation.mutateAsync,

    updateQuietHours: updateQuietHoursMutation.mutate,
    updateQuietHoursAsync: updateQuietHoursMutation.mutateAsync,

    resetSettings: resetSettingsMutation.mutate,
    resetSettingsAsync: resetSettingsMutation.mutateAsync,

    isUpdatingChannel: updateChannelMutation.isPending,
    isUpdatingQuietHours: updateQuietHoursMutation.isPending,
    isResetting: resetSettingsMutation.isPending,
};
}