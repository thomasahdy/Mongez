import SettingsSidebar from "../settings/sections/SettingsSidebar";
import NotificationsHeader from "../../components/notifications/NotificationsHeader";
import NotificationChannelsCard from "../../components/notifications/NotificationChannelsCard";
import QuietHoursCard from "../../components/notifications/QuietHoursCard";
import NotificationSkeleton from "../../components/notifications/NotificationSkeleton";

import { useNotificationSettings } from "../../hooks/api/notifications/useNotificationSettings";
import { useNotificationMutations } from "../../hooks/api/notifications/useNotificationMutations";

const NotificationsPage = () => {
    const {
        data,
        isLoading,
        error,
    } = useNotificationSettings();

    const {
        updateChannel,
        updateQuietHours,
    } = useNotificationMutations();

    const handleToggleChannel = (
        id,
        channel,
        enabled
    ) => {
        updateChannel({
            id,
            channel,
            enabled,
        });
    };

    const handleToggleQuietHours = (enabled) => {
        updateQuietHours({
            ...data?.quietHours,
            enabled,
        });
    };

    const handleChangeStartTime = (startTime) => {
        updateQuietHours({
            ...data?.quietHours,
            startTime,
        });
    };

    const handleChangeEndTime = (endTime) => {
        updateQuietHours({
            ...data?.quietHours,
            endTime,
        });
    };

    const handleToggleWeekend = (
        weekendNotifications
    ) => {
        updateQuietHours({
            ...data?.quietHours,
            weekendNotifications,
        });
    };

    return (
        <div className="flex gap-8">
            <SettingsSidebar activeId="notification" />

            <div className="settings-content-area">
                <div className="settings-content-max space-y-6">
                    {isLoading ? (
                        <NotificationSkeleton />
                    ) : error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600">
                            Failed to load notification settings.
                        </div>
                    ) : (
                        <>
                            <NotificationsHeader />

                            <NotificationChannelsCard
                                settings={data?.channels ?? []}
                                onToggle={handleToggleChannel}
                                loading={false}
                            />

                            <QuietHoursCard
                                settings={
                                    data?.quietHours ?? {
                                        enabled: false,
                                        startTime: "11:00 PM",
                                        endTime: "7:00 AM",
                                        weekendNotifications: false,
                                    }
                                }
                                loading={false}
                                onToggleQuietHours={
                                    handleToggleQuietHours
                                }
                                onChangeStartTime={
                                    handleChangeStartTime
                                }
                                onChangeEndTime={
                                    handleChangeEndTime
                                }
                                onToggleWeekend={
                                    handleToggleWeekend
                                }
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;