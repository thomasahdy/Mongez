import React, { useEffect, useState } from "react";
import { get2FAStatus } from "../../services/api/securityService";
import EnableTwoFactorModal from "./EnableTwoFactorModal";
import DisableTwoFactorModal from "./DisableTwoFactorModal";

const TwoFactorCard = () => {

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
        setError("Failed to load two-factor authentication status.");
    } finally {
        setLoading(false);
    }
};

useEffect(() => {
    loadStatus();
}, []);

const handleToggle2FA = async () => {
    if (enabled) {
        setShowDisableModal(true);
    } else {
        setShowEnableModal(true);
    }
};

return (
    <>
    <div className="security-section">
        <div>
            <div className="security-section-title">
                <i className="fa-solid fa-shield-halved" style={{ color: "var(--success)" }}></i>
                Two-Factor Authentication (2FA)
            </div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>Require Authenticator App</h4>
                    <p>Protect your account with an extra layer of security. We will ask for a 2FA code every time you sign in on a new device.</p>
                </div>
                
                <button type="button" className="btn btn-outline" style={{ background: "white", borderColor: "var(--success)", color: "var(--success)" }} disabled={loading} onClick={handleToggle2FA}> {loading ? "Please wait..." : enabled ? "Disable 2FA" : "Enable 2FA" } </button>
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
