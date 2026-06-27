import ToggleSwitch from "./ToggleSwitch";

const QuietHoursCard = ({
    settings,
    onToggleQuietHours,
    onChangeStartTime,
    onChangeEndTime,
    onToggleWeekend,
    loading,
}) => {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <i className="fa-solid fa-moon text-indigo-500"></i>
                <span>Quiet Hours & Focus</span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
                Pause non-urgent notifications during off-hours to stay focused.
            </p>

            <div className="flex items-center justify-between border-b border-gray-100 py-5">
                <div>
                    <h4 className="font-medium text-gray-900">
                        Enable Quiet Hours
                    </h4>
                    <p className="text-sm text-gray-500">
                        Silence all notifications except urgent task assignments
                        and overdue alerts.
                    </p>
                </div>

                <ToggleSwitch
                    checked={settings.enabled}
                    onChange={onToggleQuietHours}
                    disabled={loading}
                />
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 py-5">
                <div>
                    <h4 className="font-medium text-gray-900">
                        Quiet Hours Schedule
                    </h4>
                    <p className="text-sm text-gray-500">
                        Notifications will be held and delivered when quiet
                        hours end.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={settings.startTime}
                        onChange={(e) =>
                            onChangeStartTime(e.target.value)
                        }
                        disabled={loading}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                        <option value="8:00 PM">8:00 PM</option>
                        <option value="9:00 PM">9:00 PM</option>
                        <option value="10:00 PM">10:00 PM</option>
                        <option value="11:00 PM">11:00 PM</option>
                    </select>

                    <span className="text-gray-500">to</span>

                    <select
                        value={settings.endTime}
                        onChange={(e) =>
                            onChangeEndTime(e.target.value)
                        }
                        disabled={loading}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                        <option value="7:00 AM">7:00 AM</option>
                        <option value="8:00 AM">8:00 AM</option>
                        <option value="9:00 AM">9:00 AM</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between pt-5">
                <div>
                    <h4 className="font-medium text-gray-900">
                        Weekend Notifications
                    </h4>
                    <p className="text-sm text-gray-500">
                        Receive notifications on Friday & Saturday (Egyptian
                        weekend).
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