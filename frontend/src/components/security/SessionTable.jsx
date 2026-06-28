import React from "react";
import SessionRow from "./SessionRow";
import SecurityEmptyState from "./SecurityEmptyState";

const SessionTable = ({ sessions, onTerminate, loading, actionLoading }) => {
    if (loading) {
        return (
            <div className="security-section">
                Loading sessions...
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <SecurityEmptyState
                icon="fa-solid fa-laptop"
                title="No active sessions"
                description="You don't have any active sessions right now."
            />
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="sessions-table">
                <thead>
                    <tr>
                        <th>Device & Location</th>
                            
                        <th>IP Address</th>
                            
                        <th>Last Active</th>
                            
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
