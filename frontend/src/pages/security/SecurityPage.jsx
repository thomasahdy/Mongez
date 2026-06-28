import React from "react";
import SecuritySkeleton from "../../components/security/SecuritySkeleton";
import SettingsSidebar from "../../pages/settings/sections/SettingsSidebar";

const SecurityPage = () => {
    return (
        <div className="settings-layout">
            <SettingsSidebar activeId="security" />

            <div className="settings-content-area">
                <div className="settings-content-max">
                    <SecuritySkeleton />
                </div>
            </div>
        </div>
    );
};

export default SecurityPage;
