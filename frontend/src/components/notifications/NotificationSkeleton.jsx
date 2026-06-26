const NotificationSkeleton = () => {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-64 rounded bg-gray-200"></div>

            <div className="h-72 rounded-xl bg-gray-100"></div>

            <div className="h-64 rounded-xl bg-gray-100"></div>
        </div>
    );
};

export default NotificationSkeleton;