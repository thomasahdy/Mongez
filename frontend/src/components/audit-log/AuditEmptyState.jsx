const AuditEmptyState = ({
    title = "No audit logs found",
    description = "No activity matches your current filters. Try adjusting your search, date range, or selected action.",
    icon = "fa-clock-rotate-left",
    className = "",
}) => {
return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center ${className}`}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <i className={`fa-solid ${icon} text-2xl text-gray-400`}></i>
        </div>

        <h3 className="text-lg font-semibold text-gray-900">
        {title}</h3>

        <p className="mt-2 max-w-md text-sm text-gray-500">
        {description}
        </p>
    </div>
);
};

export default AuditEmptyState;
