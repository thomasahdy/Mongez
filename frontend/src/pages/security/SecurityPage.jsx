import React from "react";
import SecuritySkeleton from "../../components/security/SecuritySkeleton";
import SettingsSidebar from "../../pages/settings/sections/SettingsSidebar";

const SecurityPage = () => {
    return (
        <div className="flex gap-8">
            <SettingsSidebar activeId="security" />

            <div className="flex-1">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                    <SecuritySkeleton />
                </div>
            </div>
        </div>
    );
};

export default SecurityPage;