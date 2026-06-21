import SessionTable from "./SessionTable";
import React from "react";
import useSecurity from "../../hooks/useSecurity";

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
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <i className="fa-solid fa-laptop text-blue-600"></i>
                        <span>Active Sessions</span>
                    </div>

                    <button
                        type="button"
                        onClick={removeAllOtherSessions}
                        disabled={actionLoading || sessions.filter((s) => !s.isCurrent).length === 0}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {actionLoading ? "Signing out..." : "Sign out of all other sessions"}
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
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