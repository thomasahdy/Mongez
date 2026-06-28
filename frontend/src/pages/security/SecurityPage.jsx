import React from "react";
import useLocaleDirection from "../../hooks/useLocaleDirection";
import SecuritySkeleton from "../../components/security/SecuritySkeleton";
import SettingsSidebar from "../../pages/settings/sections/SettingsSidebar";

const SecurityPage = () => {
    const { dir, isRtl } = useLocaleDirection();

    return (
        <div className={`settings-layout ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
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
