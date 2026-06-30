import SessionTable from "./SessionTable";
import { useTranslation } from "react-i18next";
import useSecurity from "../../pages/security/useSecurity";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const SessionsCard = () => {
    const { t } = useTranslation();
    const { dir, isRtl } = useLocaleDirection();
    const {
        sessions,
        loading,
        actionLoading,
        error,
        removeSession,
        removeAllOtherSessions,
    } = useSecurity();

    return (
        <div className="security-section" dir={dir}>
            <div>
                <div className="security-section-title" style={{ justifyContent: "space-between" }}>
                    <span>
                        <i className="fa-solid fa-laptop" style={isRtl ? { color: "var(--accent)", marginLeft: 8 } : { color: "var(--accent)", marginRight: 8 }}></i>
                        {t("securityPage.sessions.title")}
                    </span>

                    <button
                        type="button"
                        onClick={removeAllOtherSessions}
                        disabled={actionLoading || sessions.filter((s) => !s.isCurrent).length === 0}
                        className="btn btn-outline"
                        style={{ fontSize: 11, padding: "4px 10px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                    >
                        {actionLoading ? t("securityPage.sessions.signingOutOthers") : t("securityPage.sessions.signOutOthers")}
                    </button>
                </div>

                {error && (
                    <div className="form-error">
                        {error.includes(".") ? error : t(error)}
                    </div>
                )}

                <SessionTable
                    sessions={sessions}
                    onTerminate={removeSession}
                    loading={loading}
                    actionLoading={actionLoading}
                />
            </div>
        </div>
    );
};

export default SessionsCard;
