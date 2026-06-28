import ToggleSwitch from "./ToggleSwitch";
import { useTranslation } from "react-i18next";

const QuietHoursCard = ({
    settings,
    onToggleQuietHours,
    onChangeStartTime,
    onChangeEndTime,
    onToggleWeekend,
    loading,
}) => {
    const { t } = useTranslation();
    return (
        <div className="notif-section">
            <div className="notif-section-title">
                <i className="fa-solid fa-moon channel-inapp"></i>
                {t("notificationsPage.quietHoursTitle")}
            </div>

            <div className="notif-section-desc">
                {t("notificationsPage.quietHoursDescription")}
            </div>

            <div className="dnd-row pt-0">
                <div className="dnd-info">
                    <h4>{t("notificationsPage.enableQuietHours")}</h4>
                    <p>
                        {t("notificationsPage.enableQuietHoursDescription")}
                    </p>
                </div>

                <ToggleSwitch
                    checked={settings.enabled}
                    onChange={onToggleQuietHours}
                    disabled={loading}
                />
            </div>

            <div className="dnd-row">
                <div className="dnd-info">
                    <h4>{t("notificationsPage.quietHoursSchedule")}</h4>
                    <p>
                        {t("notificationsPage.quietHoursScheduleDescription")}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={settings.startTime}
                        onChange={(e) =>
                            onChangeStartTime(e.target.value)
                        }
                        disabled={loading}
                        className="time-select"
                    >
                        <option value="8:00 PM">8:00 PM</option>
                        <option value="9:00 PM">9:00 PM</option>
                        <option value="10:00 PM">10:00 PM</option>
                        <option value="11:00 PM">11:00 PM</option>
                    </select>

                    <span className="text-gray-500">{t("notificationsPage.between")}</span>

                    <select
                        value={settings.endTime}
                        onChange={(e) =>
                            onChangeEndTime(e.target.value)
                        }
                        disabled={loading}
                        className="time-select"
                    >
                        <option value="7:00 AM">7:00 AM</option>
                        <option value="8:00 AM">8:00 AM</option>
                        <option value="9:00 AM">9:00 AM</option>
                    </select>
                </div>
            </div>

            <div className="dnd-row">
                <div className="dnd-info">
                    <h4>{t("notificationsPage.weekendNotifications")}</h4>
                    <p>
                        {t("notificationsPage.weekendDescription")}
                    </p>
                </div>

                <ToggleSwitch
                    checked={settings.weekendNotifications}
                    onChange={onToggleWeekend}
                    disabled={loading}
                />
            </div>
        </div>
    );
};

export default QuietHoursCard;
