import NotificationChannelsTable from "./NotificationChannelTable";
import { useTranslation } from "react-i18next";

const NotificationChannelsCard = ({ settings, onToggle, loading, }) => {
    const { t } = useTranslation();
    if(loading){
        return (
            <div className="notif-section">
                {t("notificationsPage.channelsLoading")}
            </div>
        );
    }

    return (
        <div className="notif-section">
            <div className="notif-section-title">
                <i className="fa-solid fa-sliders channel-email"></i>
                {t("notificationsPage.channelsTitle")}
            </div>

            <div className="notif-section-desc">
                {t("notificationsPage.channelsDescription")}
            </div>

            <div className="overflow-x-auto">
                <NotificationChannelsTable settings={settings} onToggle={onToggle}/>
            </div>
        </div>
    );
};

export default NotificationChannelsCard;
