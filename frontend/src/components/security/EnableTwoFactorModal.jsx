import React, {useEffect, useState} from "react";
import { useTranslation } from "react-i18next";
import {enable2FA, verify2FA} from "../../services/api/securityService";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const EnableTwoFactorModal = ({ onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { dir } = useLocaleDirection();
    const [step, setStep] = useState("loading"); 
    const [qrCode, setQrCode] = useState("");
    const [secret, setSecret] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        const startEnrollment = async () => {
            try {
                const data = await enable2FA();
                setQrCode(data?.qrCode || "");
                setSecret(data?.secret || "");
                setStep("scan");
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.error?.message || t("securityPage.modals.startFailed"));
                setStep("error");
            }
        };

        startEnrollment();
    }, []);

    const handleVerify = async (e) => { 
        e.preventDefault();
        setError("");

        if(!code.trim() || code.trim().length !== 6 ) {
            setError(t("securityPage.modals.validCode"));
            return;
        }

        setVerifying(true);

        try {
            await verify2FA(code.trim());
            onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error?.message || t("securityPage.modals.verifyFailed"));
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir={dir}>
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{t("securityPage.modals.enableTitle")}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {step === "loading" && (
                    <p className="mt-6 text-sm text-gray-500">{t("securityPage.modals.settingUp")}</p>
                )}

                {step === "error" && (
                    <div className="mt-6 space-y-4">
                        <p className="text-sm text-red-500">{error}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                            {t("securityPage.modals.close")}
                        </button>
                    </div>
                )}

                {step === "scan" && (
                    <form className="mt-6 space-y-5" onSubmit={handleVerify}>
                        <p className="text-sm text-gray-500">
                            {t("securityPage.modals.scanDescription")}
                        </p>

                        {qrCode && (
                            <div className="flex justify-center">
                                <img src={qrCode} alt={t("securityPage.twoFactor.qrAlt")} className="h-40 w-40 rounded-lg border border-gray-200" />
                            </div>
                        )}

                        {secret && (
                            <p className="break-all rounded-lg bg-gray-50 px-3 py-2 text-center font-mono text-xs text-gray-600">
                                {secret}
                            </p>
                        )}

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">{t("securityPage.modals.verificationCode")}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder={t("securityPage.twoFactor.codePlaceholder")}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                            />
                            {error && <p className="text-xs text-red-500">{error}</p>}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                                {t("securityPage.modals.cancel")}
                            </button>
                            <button
                                type="submit"
                                disabled={verifying}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {verifying ? t("securityPage.modals.verifying") : t("securityPage.modals.verifyEnable")}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default EnableTwoFactorModal;
