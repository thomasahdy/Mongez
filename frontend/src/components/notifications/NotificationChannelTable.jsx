import NotificationChannelsRow from "./NotificationChannelRow";
import { useTranslation } from "react-i18next";

const NotificationChannelsTable = ({
    settings = [],
    onToggle,
}) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Event
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-bell text-purple-500"></i>
                                <span>In-App</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-solid fa-envelope text-sky-500"></i>
                                <span>Email</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-brands fa-whatsapp text-green-500"></i>
                                <span>WhatsApp</span>
                            </div>
                        </th>

                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center gap-1">
                                <i className="fa-brands fa-telegram text-sky-500"></i>
                                <span>Telegram</span>
                            </div>
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {settings.map((setting) => (
                        <NotificationChannelsRow
                            key={setting.id}
                            setting={setting}
                            onToggle={onToggle}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default NotificationChannelsTable;
