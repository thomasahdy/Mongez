import { useTranslation } from "react-i18next";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const AuditHeader = () => {
const { t } = useTranslation();
const { dir } = useLocaleDirection();
return (
    <div className="audit-header" dir={dir}>
        <div> 
            <h1 className="audit-title">{t("auditLogPage.title")}</h1>
            <p className="audit-subtitle">{t("auditLogPage.subtitle")}</p>

        </div>
        <div className="immutable-badge">
            <i className="fa-solid fa-lock"></i>
            <span>Immutable · Write-once</span>
            
        </div>
    </div>
);
};

export default AuditHeader;
