import { useEffect } from "react";
import SettingsSidebar from "../settings/sections/SettingsSidebar";
import NotificationsHeader from "../../components/notifications/NotificationsHeader";
import NotificationChannelsCard from "../../components/notifications/NotificationChannelsCard";
import QuietHoursCard from "../../components/notifications/QuietHoursCard";
import NotificationSkeleton from "../../components/notifications/NotificationSkeleton";
import MessagingLinkingCard from "../../components/notifications/MessagingLinkingCard";

import { useAppContext } from "../AppContext";
import { useIntegrationStatusesQuery } from "../../hooks/useSettingsQueries";
import { useNotificationSettings } from "../../hooks/api/notifications/useNotificationSettings";
import { useNotificationMutations } from "../../hooks/api/notifications/useNotificationMutations";

const notificationsPath = [
    { name: "Settings", color: "text-slate-400", ref: "/settings" },
    { name: "Notifications", color: "text-slate-800", ref: "/settings/notifications" },
];

const NotificationsPage = ({ setPath }) => {
    useEffect(() => {
        setPath?.(notificationsPath);
    }, [setPath]);

    const { activeSpaceId } = useAppContext();
    const statusesQuery = useIntegrationStatusesQuery(activeSpaceId);
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
        <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar activeId="notifications" />

            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900" aria-label="Notification settings">
                <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
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
                                        startTime: "22:00",
                                        endTime: "07:00",
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

                            <div className="pt-4 border-t border-slate-150 dark:border-slate-800">
                                <h3 className="text-md font-black tracking-tight text-slate-800 dark:text-slate-100 mb-4 uppercase text-xs tracking-widest text-slate-400">
                                    Delivery Channels Linking
                                </h3>
                                <MessagingLinkingCard
                                    spaceId={activeSpaceId}
                                    telegramStatus={statusesQuery.data?.telegram}
                                    whatsappStatus={statusesQuery.data?.whatsapp}
                                    onRefetch={() => statusesQuery.refetch()}
                                />
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default NotificationsPage;