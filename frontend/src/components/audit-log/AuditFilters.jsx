const DEFAULT_ACTIONS = [
    { value: "all", label: "All Actions" },
    { value: "create", label: "Create" },
    { value: "update", label: "Update" },
    { value: "delete", label: "Delete" },
    { value: "login", label: "Login" },
    { value: "permission", label: "Permission Change" },
]

const DEFAULT_DATE_RANGES = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "custom", label: "Custom Range" },
]

const AuditFilters = ({
    filters,
    onFilterChange,
    onReset,
    actionOptions = DEFAULT_ACTIONS,
    userOptions = [],
    dateRangeOptions = DEFAULT_DATE_RANGES,
    loading = false,
}) => {
    const searchValue = filters?.search ?? ""
    const actionValue = filters?.action ?? "all"
    const userValue = filters?.user ?? "all"
    const dateRangeValue = filters?.dateRange ?? "30d"

return (
    <div className="audit-filters">
        <label>
            <select
                value={actionValue}
                onChange={(event) => onFilterChange?.("action", event.target.value)}
                disabled={loading}
                className="filter-select"
                aria-label="Action"
            >
                {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>

        <label>
            <select
                value={userValue}
                onChange={(event) => onFilterChange?.("user", event.target.value)}
                disabled={loading}
                className="filter-select"
                aria-label="User"
            >
                <option value="all">All Users</option>
                {userOptions.map((user) => {
                    const value = typeof user === "string" ? user : user.value
                    const label = typeof user === "string" ? user : user.label

                    return (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    )
                })}
            </select>
        </label>

        <label>
            <select
                value={dateRangeValue}
                onChange={(event) => onFilterChange?.("dateRange", event.target.value)}
                disabled={loading}
                className="filter-select"
                aria-label="Date Range"
            >
                {dateRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>

        <label className="filter-search-wrap">
            <div>
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => onFilterChange?.("search", event.target.value)}
                    disabled={loading}
                    className="filter-search"
                    placeholder="Search by resource, IP, or details..."
                    aria-label="Search audit logs"
                />
            </div>
        </label>

        <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="btn btn-outline"
        >
            Reset
        </button>
    </div>
);
};

export default AuditFilters;
