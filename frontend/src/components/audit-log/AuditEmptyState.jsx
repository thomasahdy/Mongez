const AuditEmptyState = ({
    title = "No audit logs found",
    description = "No activity matches your current filters. Try adjusting your search, date range, or selected action.",
    icon = "fa-clock-rotate-left",
    className = "",
}) => {
return (
    <div className={`security-section ${className}`} style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 16 }}>
            <i className={`fa-solid ${icon}`} style={{ color: "var(--text-tertiary)", fontSize: 24 }}></i>
        </div>

        <h3 className="settings-title">
        {title}</h3>

        <p className="settings-subtitle">
        {description}
        </p>
    </div>
);
};

export default AuditEmptyState;
