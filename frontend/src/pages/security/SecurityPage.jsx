import React, { useEffect } from "react";
import SecuritySkeleton from "../../components/security/SecuritySkeleton";
import SettingsSidebar from "../../pages/settings/sections/SettingsSidebar";

const securityPath = [
    { name: "Settings", color: "text-slate-400", ref: "/settings" },
    { name: "Security", color: "text-slate-800", ref: "/settings/security" },
];

const SecurityPage = ({ setPath }) => {
    useEffect(() => {
        setPath?.(securityPath);
    }, [setPath]);

    return (
        <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar activeId="security" />

            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900" aria-label="Security settings">
                <div className="mx-auto max-w-6xl px-6 py-6">
                    <SecuritySkeleton />
                </div>
            </main>
        </div>
    );
};

export default SecurityPage;