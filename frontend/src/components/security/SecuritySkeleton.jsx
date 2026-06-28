import PasswordCard from "./PasswordCard";
import SecurityHeader from "./SecurityHeader";
import TwoFactorCard from "./TwoFactorCard";
import SessionManagementCard from "./SessionManagementCard";
import SessionsCard from "./SessionsCard";

const SecuritySkeleton = () => {
    return (
        <>
            <SecurityHeader />
            <PasswordCard />
            <TwoFactorCard />
            <SessionManagementCard />
            <SessionsCard />
        </>
    );
};

export default SecuritySkeleton;
