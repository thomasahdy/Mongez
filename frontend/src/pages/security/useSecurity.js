import { useState, useEffect, useCallback } from "react";
import {
    getSessions,
    terminateSession,
    terminateAllSessions,
} from "../../services/api/securityService";

const useSecurity = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getSessions();
            setSessions(data);
        } catch (err) {
            console.error(err);
            setError("securityPage.sessions.loadFailed");
        } finally {
            setLoading(false);
        }
    }, []);

    const removeSession = useCallback(async (sessionId) => {
        setActionLoading(true);
        setError("");

        try {
            await terminateSession(sessionId);
            setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        } catch (err) {
            console.error(err);
            setError("securityPage.sessions.terminateFailed");
        } finally {
            setActionLoading(false);
        }
    }, []);

    const removeAllOtherSessions = useCallback(async () => {
        setActionLoading(true);
        setError("");

        try {
            await terminateAllSessions();
            setSessions((prev) => prev.filter((session) => session.isCurrent));
        } catch (err) {
            console.error(err);
            setError("securityPage.sessions.terminateAllFailed");
        } finally {
            setActionLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    return {
        sessions,
        loading,
        actionLoading,
        error,
        refetch: fetchSessions,
        removeSession,
        removeAllOtherSessions,
    };
};

export default useSecurity;
