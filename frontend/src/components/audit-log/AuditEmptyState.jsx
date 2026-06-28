import { useTranslation } from "react-i18next"
import useLocaleDirection from "../../hooks/useLocaleDirection"

const AuditEmptyState = ({
    title,
    description,
    icon = "fa-clock-rotate-left",
    className = "",
}) => {
const { t } = useTranslation()
const { dir } = useLocaleDirection()
const resolvedTitle = title ?? t("auditLogPage.emptyTitle")
const resolvedDescription = description ?? t("auditLogPage.emptyDescription")
return (
    <div className={`security-section ${className}`} style={{ textAlign: "center" }} dir={dir}>
        <div style={{ marginBottom: 16 }}>
            <i className={`fa-solid ${icon}`} style={{ color: "var(--text-tertiary)", fontSize: 24 }}></i>
        </div>

        <h3 className="settings-title">
        {resolvedTitle}</h3>

        <p className="settings-subtitle">
        {resolvedDescription}
        </p>
    </div>
);
};

export default AuditEmptyState;
