import React from "react";
import SecuritySkeleton from "../components/security/SecuritySkeleton";

const SecurityPage = () => {
    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <SecuritySkeleton />
        </div>
    );
};

export default SecurityPage;