import SettingsSidebar from "../settings/sections/SettingsSidebar";
import { useTranslation } from "react-i18next";
import NotificationsHeader from "../../components/notifications/NotificationsHeader";
import NotificationChannelsCard from "../../components/notifications/NotificationChannelsCard";
import QuietHoursCard from "../../components/notifications/QuietHoursCard";
import NotificationSkeleton from "../../components/notifications/NotificationSkeleton";

import { useNotificationSettings } from "../../hooks/api/notifications/useNotificationSettings";
import { useNotificationMutations } from "../../hooks/api/notifications/useNotificationMutations";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const NotificationsPage = () => {
    const { t } = useTranslation();
    const { isRTL } = useLocaleDirection();
    const {
        data,
        isLoading,
        error,
    } = useNotificationSettings();

    const {
        updateChannel,
        updateQuietHours,
    } = useNotificationMutations();
    const settingsData = data?.data ?? data;

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
            ...settingsData?.quietHours,
            enabled,
        });
    };

    const handleChangeStartTime = (startTime) => {
        updateQuietHours({
            ...settingsData?.quietHours,
            startTime,
        });
    };

    const handleChangeEndTime = (endTime) => {
        updateQuietHours({
            ...settingsData?.quietHours,
            endTime,
        });
    };

    const handleToggleWeekend = (
        weekendNotifications
    ) => {
        updateQuietHours({
            ...settingsData?.quietHours,
            weekendNotifications,
        });
    };

    return (
        <div className="settings-layout" dir={isRTL ? "rtl" : "ltr"}>
            <SettingsSidebar activeId="notifications" />

            <div className={`settings-content-area ${isRTL ? "text-right" : "text-left"}`}>
                <div className="settings-content-max">
                    {isLoading ? (
                        <NotificationSkeleton />
                    ) : error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600">
                            {t("notificationsPage.loadFailed")}
                        </div>
                    ) : (
                        <>
                            <NotificationsHeader />

                            <NotificationChannelsCard
                                settings={settingsData?.channels ?? []}
                                onToggle={handleToggleChannel}
                                loading={false}
                            />

                            <QuietHoursCard
                                settings={
                                    settingsData?.quietHours ?? {
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
