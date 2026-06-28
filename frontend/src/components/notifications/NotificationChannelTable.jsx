import NotificationChannelsRow from "./NotificationChannelRow";
import { useTranslation } from "react-i18next";

const NotificationChannelsTable = ({
    settings = [],
    onToggle,
}) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-x-auto">
            <table className="channel-matrix">
                <thead>
                    <tr>
                        <th>{t("notificationsPage.event")}</th>

                        <th>
                            <i className="channel-icon channel-inapp fa-solid fa-bell"></i>
                            <br />
                            {t("notificationsPage.inApp")}
                        </th>

                        <th>
                            <i className="channel-icon channel-email fa-solid fa-envelope"></i>
                            <br />
                            {t("notificationsPage.email")}
                        </th>

                        <th>
                            <i className="channel-icon channel-whatsapp fa-brands fa-whatsapp"></i>
                            <br />
                            {t("notificationsPage.whatsapp")}
                        </th>

                        <th>
                            <i className="channel-icon channel-telegram fa-brands fa-telegram"></i>
                            <br />
                            {t("notificationsPage.telegram")}
                        </th>
                    </tr>
                </thead>

                <tbody>
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
