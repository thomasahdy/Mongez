import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { get2FAStatus } from "../../services/api/securityService";
import EnableTwoFactorModal from "./EnableTwoFactorModal";
import DisableTwoFactorModal from "./DisableTwoFactorModal";

const TwoFactorCard = () => {
const { t } = useTranslation();

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
        setError(t("securityUi.loadFailed"));
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
    <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <i className="fa-solid fa-shield-halved text-green-600"></i>
                <span>{t("securityUi.twoFactorTitle")}</span>
            </div>
            
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h4 className="font-medium text-gray-900">{t("securityUi.requireAuthenticator")}</h4>
                    <p className="max-w-2xl text-sm text-gray-500">{t("securityUi.twoFactorDescription")}</p>
                </div>
                
                <button type="button" className="rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 transition hover:bg-green-50" disabled={loading} onClick={handleToggle2FA}> {loading ? t("securityUi.pleaseWait") : enabled ? t("securityUi.disable2fa") : t("securityUi.enable2fa")} </button>
            </div>
            {error && <p className="text-sm text-red-500"> {error} </p>}
        </div>
    </div>

    {showEnableModal && (<EnableTwoFactorModal onClose={() => setShowEnableModal(false)} onSuccess={() => {setShowEnableModal(false); setEnabled(true);}} />)}

    {showDisableModal && (<DisableTwoFactorModal onClose={() => setShowDisableModal(false)} onSuccess={() => {setShowDisableModal(false); setEnabled(false);}} />)}
    
    </>
);
};

export default TwoFactorCard;
