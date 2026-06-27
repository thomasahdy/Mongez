import React, { useEffect, useState } from "react";
import { getSessionSettings, updateSessionSettings } from "../../services/api/securityService";

const SessionManagementCard = () => {

    const [sessionTimeout, setSessionTimeout] = useState("30");
    const [persistentLogin, setPersistentLogin] = useState(true);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [saving, setSaving] = useState(false);

    const loadingSetting = async () => {
        setLoading(true);
        setError("");
        try {
            const settings = await getSessionSettings();
            setSessionTimeout(String(settings.sessionTimeout));
            setPersistentLogin(settings.persistentLogin);
        } catch (err) {
            setError("Failed to load session settings.");
        } finally {
            setLoading(false);  
        }
    };

    useEffect(() => {
        loadingSetting();
    }, []);

    if(loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                Loading session settings...
            </div>
        );
    }

    const handleSaveSettings = async () => {
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await updateSessionSettings({
                sessionTimeout,
                persistentLogin,
            });
            setSuccess("Settings saved successfully.");
        } catch (err) {
            setError("Failed to save settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <i className="fa-solid fa-clock text-amber-500"></i>
                <span>Session Management</span>
            </div>
            
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h4 className="font-medium text-gray-900"> Session Timeout </h4>
                    
                    <p className="max-w-2xl text-sm text-gray-500"> Automatically sign out inactive sessions after a period of time. Recommended for shared devices.</p>
                </div>
                
                <select 
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                    <option value="1440">24 hours</option>
                    <option value="never">Never</option>
                </select>
            </div>
            
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h4 className="font-medium text-gray-900"> Persistent Login (30-day) </h4>
                    <p className="max-w-2xl text-sm text-gray-500"> Allow users to stay signed in for up to 30 days on trusted devices.</p>
                </div>
                
                <button
                type="button"
                aria-pressed={persistentLogin}
                aria-label="Toggle persistent login"
                onClick={() => setPersistentLogin((prev) => !prev)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${persistentLogin ? "bg-green-500" : "bg-gray-300"}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${persistentLogin ? "translate-x-6" : "translate-x-1"}`}/>
                </button>

                <div className="flex justify-end">
                    <button type="button" onClick={handleSaveSettings} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>

                {error && (<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>)}

                {success && (<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">{success}</div>)}
            </div>
        </div>
    </div>
    );
};

export default SessionManagementCard;