import SessionTable from "./SessionTable";
import React from "react";
import useSecurity from "../../pages/security/useSecurity";

const SessionsCard = () => {
    const {
        sessions,
        loading,
        actionLoading,
        error,
        removeSession,
        removeAllOtherSessions,
    } = useSecurity();

    return (
        <div className="security-section">
            <div>
                <div className="security-section-title" style={{ justifyContent: "space-between" }}>
                    <span>
                        <i className="fa-solid fa-laptop" style={{ color: "var(--accent)", marginRight: 8 }}></i>
                        Active Sessions
                    </span>

                    <button
                        type="button"
                        onClick={removeAllOtherSessions}
                        disabled={actionLoading || sessions.filter((s) => !s.isCurrent).length === 0}
                        className="btn btn-outline"
                        style={{ fontSize: 11, padding: "4px 10px", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                    >
                        {actionLoading ? "Signing out..." : "Sign out of all other sessions"}
                    </button>
                </div>

                {error && (
                    <div className="form-error">
                        {error}
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
