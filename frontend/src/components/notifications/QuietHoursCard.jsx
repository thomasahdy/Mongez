import ToggleSwitch from "./ToggleSwitch";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const QuietHoursCard = ({
    settings,
    onToggleQuietHours,
    onChangeStartTime,
    onChangeEndTime,
    onToggleWeekend,
    loading,
}) => {
    const { t } = useTranslation();
    const { isRTL } = useLocaleDirection();
    return (
        <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm" dir={isRTL ? "rtl" : "ltr"}>
            <div className={`flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100 ${isRTL ? "flex-row-reverse" : ""}`}>
                <i className="fa-solid fa-moon text-indigo-500"></i>
                <span>{t("notificationsPage.quietHoursTitle")}</span>
            </div>

            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t("notificationsPage.quietHoursDescription")}
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 py-5">
                <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                        {t("notificationsPage.enableQuietHours")}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("notificationsPage.enableQuietHoursDescription")}
                    </p>
                </div>

                <ToggleSwitch
                    checked={settings.enabled}
                    onChange={onToggleQuietHours}
                    disabled={loading}
                />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 py-5">
                <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                        {t("notificationsPage.quietHoursSchedule")}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("notificationsPage.quietHoursScheduleDescription")}
                    </p>
                </div>

                <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <select
                        value={settings.startTime}
                        onChange={(e) =>
                            onChangeStartTime(e.target.value)
                        }
                        disabled={loading}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none"
                    >
                        <option value="20:00">8:00 PM</option>
                        <option value="21:00">9:00 PM</option>
                        <option value="22:00">10:00 PM</option>
                        <option value="23:00">11:00 PM</option>
                    </select>

                    <span className="text-slate-400 dark:text-slate-500">{t("notificationsPage.between")}</span>

                    <select
                        value={settings.endTime}
                        onChange={(e) =>
                            onChangeEndTime(e.target.value)
                        }
                        disabled={loading}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none"
                    >
                        <option value="07:00">7:00 AM</option>
                        <option value="08:00">8:00 AM</option>
                        <option value="09:00">9:00 AM</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between pt-5">
                <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                        {t("notificationsPage.weekendNotifications")}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("notificationsPage.weekendDescription")}
                    </p>
                </div>

                <ToggleSwitch
                    checked={settings.weekendNotifications}
                    onChange={onToggleWeekend}
                    disabled={loading}
                />
            </div>
        </div >
    );
};

export default QuietHoursCard;
