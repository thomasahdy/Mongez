import React from "react";
import SessionRow from "./SessionRow";
import SecurityEmptyState from "./SecurityEmptyState";

const SessionTable = ({ sessions, onTerminate, loading, actionLoading }) => {
    if (loading) {
        return (
            <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
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
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Device & Location</th>
                            
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                            IP Address</th>
                            
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Last Active</th>
                            
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                
                <tbody className="divide-y divide-gray-100 bg-white">
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