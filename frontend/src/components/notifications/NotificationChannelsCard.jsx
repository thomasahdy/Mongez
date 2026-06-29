import NotificationChannelsTable from "./NotificationChannelTable";
import { useTranslation } from "react-i18next";

const NotificationChannelsCard = ({ settings, onToggle, loading, }) => {
    if (loading) {
        return (
            <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-500 dark:text-slate-400">
                Loading...
            </div>
        );
    }

    return (
        <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                <i className="fa-solid fa-sliders text-indigo-500"></i> 
                Delivery Channels
            </div>

            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Toggle which channels receive each notification type. External channels require integration setup.
            </div>

            <div className="overflow-x-auto mt-4">
                <NotificationChannelsTable settings={settings} onToggle={onToggle}/>
            </div>
        </div >
    );
};

export default NotificationChannelsCard;
