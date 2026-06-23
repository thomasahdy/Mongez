import PasswordCard from "./PasswordCard";
import SecurityHeader from "./SecurityHeader";
import TwoFactorCard from "./TwoFactorCard";
import SessionManagementCard from "./SessionManagementCard";
import SessionsCard from "./SessionsCard";

const SecuritySkeleton = () => {
    return (
        <div className="space-y-6">
            <SecurityHeader />
            <PasswordCard />
            <TwoFactorCard />
            <SessionManagementCard />
            <SessionsCard />
        </div>
    );
};

export default SecuritySkeleton;