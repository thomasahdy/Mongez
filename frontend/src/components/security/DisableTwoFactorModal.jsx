import React, { useState } from "react";
import { disableTwoFactor } from "../../services/api/securityService";

const DisableTwoFactorModal = ({ onClose, onSuccess }) => {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if(!code.trim() || code.trim().length !== 6 ) {
            setError("Please enter a valid 6-digit code.");
            return;
        }

        setLoading(true);

        try {
            await disableTwoFactor(code.trim());
            onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error?.message || "Failed to disable 2FA. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Disable Two-Factor Authentication</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                    <p className="text-sm text-gray-500">
                        Disabling 2FA will make your account less secure. Enter the 6-digit code from your authenticator app to confirm.
                    </p>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500"
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
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? "Disabling..." : "Disable 2FA"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DisableTwoFactorModal;