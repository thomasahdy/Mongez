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
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Action
            <select
                value={actionValue}
                onChange={(event) => onFilterChange?.("action", event.target.value)}
                disabled={loading}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
                {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            User
            <select
                value={userValue}
                onChange={(event) => onFilterChange?.("user", event.target.value)}
                disabled={loading}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
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

        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Date Range
            <select
                value={dateRangeValue}
                onChange={(event) => onFilterChange?.("dateRange", event.target.value)}
                disabled={loading}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
                {dateRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>

        <label className="relative min-w-[250px] flex-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Search
            <div className="relative mt-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => onFilterChange?.("search", event.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
                    placeholder="Search by resource, IP, or details..."
                />
            </div>
        </label>

        <div className="flex items-end">
            <button
                type="button"
                onClick={onReset}
                disabled={loading}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            >
                Reset
            </button>
        </div>
    </div>
);
};

export default AuditFilters;
