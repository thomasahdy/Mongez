import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { get2FAStatus } from "../../services/api/securityService";
import EnableTwoFactorModal from "./EnableTwoFactorModal";
import DisableTwoFactorModal from "./DisableTwoFactorModal";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const TwoFactorCard = () => {
const { t } = useTranslation();
const { dir } = useLocaleDirection();

const [enabled, setEnabled] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [showEnableModal, setShowEnableModal] = useState(false);
const [showDisableModal, setShowDisableModal] = useState(false);

const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
        const status = await get2FAStatus();
        setEnabled(Boolean(status?.enabled));
    } catch (err) {
        console.error(err);
        setError(t("securityPage.twoFactor.loadFailed"));
    } finally {
        setLoading(false);
    }
};

useEffect(() => {
    loadStatus();
}, [t]);

const handleToggle2FA = async () => {
    if (enabled) {
        setShowDisableModal(true);
    } else {
        setShowEnableModal(true);
    }
};

return (
    <>
    <div className="security-section" dir={dir}>
        <div>
            <div className="security-section-title">
                <i className="fa-solid fa-shield-halved" style={{ color: "var(--success)" }}></i>
                {t("securityPage.twoFactor.title")}
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>{t("securityPage.twoFactor.requireApp")}</h4>
                    <p>{t("securityPage.twoFactor.description")}</p>
                </div>
                
                <button type="button" className="btn btn-outline" style={{ background: "white", borderColor: "var(--success)", color: "var(--success)" }} disabled={loading} onClick={handleToggle2FA}> {loading ? t("securityPage.twoFactor.waiting") : enabled ? t("securityPage.twoFactor.disable") : t("securityPage.twoFactor.enable")} </button>
            </div>
            {error && <p className="form-error">{error}</p>}
        </div>
    </div>

    {showEnableModal && (<EnableTwoFactorModal onClose={() => setShowEnableModal(false)} onSuccess={() => {setShowEnableModal(false); setEnabled(true);}} />)}

    {showDisableModal && (<DisableTwoFactorModal onClose={() => setShowDisableModal(false)} onSuccess={() => {setShowDisableModal(false); setEnabled(false);}} />)}
    
    </>
);
};

export default TwoFactorCard;
