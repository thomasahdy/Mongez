import { useTranslation } from "react-i18next";

const NotificationsHeader = () => {
const { t } = useTranslation();
return (
    <div className="settings-header">
        <h1 className="settings-title">{t("notificationsPage.title")}</h1>
        <p className="settings-subtitle">{t("notificationsPage.subtitle")}</p>
    </div>
);
};

export default NotificationsHeader;
