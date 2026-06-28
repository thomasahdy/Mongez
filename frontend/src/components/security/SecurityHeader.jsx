import { useTranslation } from "react-i18next";

const SecurityHeader = () => {
const { t } = useTranslation();
return (
    <div className="settings-header">
        <div>
            <h1 className="settings-title">{t("securityPage.title")}</h1>
            <p className="settings-subtitle">{t("securityPage.subtitle")}</p>
        </div>
    </div>
);
};

export default SecurityHeader;
