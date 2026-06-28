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
            <div className="security-section">
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
    <div className="security-section">
        <div>
            <div className="security-section-title">
                <i className="fa-solid fa-clock" style={{ color: "var(--warning)" }}></i>
                Session Management
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>Session Timeout</h4>
                    
                    <p>Automatically sign out inactive sessions after a period of time. Recommended for shared devices.</p>
                </div>
                
                <select 
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="time-select">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                    <option value="1440">24 hours</option>
                    <option value="never">Never</option>
                </select>
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>Persistent Login (30-day)</h4>
                    <p>Allow users to stay signed in for up to 30 days on trusted devices.</p>
                </div>
                
                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={persistentLogin}
                        onChange={(e) => setPersistentLogin(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                </label>
            </div>

            <div style={{ marginTop: 16 }}>
                <button type="button" onClick={handleSaveSettings} disabled={saving} className="btn btn-primary">
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {error && (<p className="form-error">{error}</p>)}

            {success && (<p className="form-success">{success}</p>)}
        </div>
    </div>
    );
};

export default SessionManagementCard;
