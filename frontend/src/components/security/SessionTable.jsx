import React from "react";
import { useTranslation } from "react-i18next";
import SessionRow from "./SessionRow";
import SecurityEmptyState from "./SecurityEmptyState";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const SessionTable = ({ sessions, onTerminate, loading, actionLoading }) => {
    const { t } = useTranslation();
    const { dir } = useLocaleDirection();
    if (loading) {
        return (
            <div className="security-section">
                {t("securityPage.sessions.loading")}
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <SecurityEmptyState
                icon="fa-solid fa-laptop"
                title={t("securityPage.sessions.emptyTitle")}
                description={t("securityPage.sessions.emptyDescription")}
            />
        );
    }

    return (
        <div className="overflow-x-auto" dir={dir}>
            <table className="sessions-table">
                <thead>
                    <tr>
                        <th>{t("securityPage.sessions.deviceLocation")}</th>
                            
                        <th>{t("securityPage.sessions.ipAddress")}</th>
                            
                        <th>{t("securityPage.sessions.lastActive")}</th>
                            
                        <th></th>
                    </tr>
                </thead>
                
                <tbody>
                    {sessions.map((session) => (
                        <SessionRow
                            key={session.id}
                            session={session}
                            onTerminate={onTerminate}
                            disabled={actionLoading}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SessionTable;
