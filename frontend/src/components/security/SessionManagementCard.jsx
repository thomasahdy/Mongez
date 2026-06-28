import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSessionSettings, updateSessionSettings } from "../../services/api/securityService";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const SessionManagementCard = () => {
    const { t } = useTranslation();
    const { dir } = useLocaleDirection();

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
            setError(t("securityPage.sessionManagement.loadFailed"));
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
                {t("securityPage.sessionManagement.loading")}
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
            setSuccess(t("securityPage.sessionManagement.saveSuccess"));
        } catch (err) {
            setError(t("securityPage.sessionManagement.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    return (
    <div className="security-section" dir={dir}>
        <div>
            <div className="security-section-title">
                <i className="fa-solid fa-clock" style={{ color: "var(--warning)" }}></i>
                {t("securityPage.sessionManagement.title")}
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>{t("securityPage.sessionManagement.timeout")}</h4>
                    
                    <p>{t("securityPage.sessionManagement.timeoutDescription")}</p>
                </div>
                
                <select 
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="time-select">
                    <option value="15">{t("securityPage.sessionManagement.minutes15")}</option>
                    <option value="30">{t("securityPage.sessionManagement.minutes30")}</option>
                    <option value="60">{t("securityPage.sessionManagement.hour1")}</option>
                    <option value="240">{t("securityPage.sessionManagement.hours4")}</option>
                    <option value="1440">{t("securityPage.sessionManagement.hours24")}</option>
                    <option value="never">{t("securityPage.sessionManagement.never")}</option>
                </select>
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>{t("securityPage.sessionManagement.persistentLogin")}</h4>
                    <p>{t("securityPage.sessionManagement.persistentLoginDescription")}</p>
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
                    {saving ? t("securityPage.sessionManagement.saving") : t("securityPage.sessionManagement.save")}
                </button>
            </div>

            {error && (<p className="form-error">{error}</p>)}

            {success && (<p className="form-success">{success}</p>)}
        </div>
    </div>
    );
};

export default SessionManagementCard;
