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
    const { t } = useTranslation()
    const { dir } = useLocaleDirection()
    const searchValue = filters?.search ?? ""
    const actionValue = filters?.action ?? "all"
    const userValue = filters?.user ?? "all"
    const dateRangeValue = filters?.dateRange ?? "30d"
    const actionLabels = {
        all: t("auditLogPage.filters.allActions"),
        create: t("auditLogPage.filters.create"),
        update: t("auditLogPage.filters.update"),
        delete: t("auditLogPage.filters.delete"),
        login: t("auditLogPage.filters.login"),
        permission: t("auditLogPage.filters.permission"),
    }
    const dateLabels = {
        "7d": t("auditLogPage.filters.last7Days"),
        "30d": t("auditLogPage.filters.last30Days"),
        "90d": t("auditLogPage.filters.last90Days"),
        custom: t("auditLogPage.filters.customRange"),
    }

return (
    <div className="audit-filters" dir={dir}>
        <label>
            <select
                value={actionValue}
                onChange={(event) => onFilterChange?.("action", event.target.value)}
                disabled={loading}
                className="filter-select"
                aria-label={t("auditLogPage.filters.action")}
            >
                {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {actionLabels[option.value] ?? option.label}
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
                aria-label={t("auditLogPage.filters.user")}
            >
                <option value="all">{t("auditLogPage.filters.allUsers")}</option>
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
                aria-label={t("auditLogPage.filters.dateRange")}
            >
                {dateRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {dateLabels[option.value] ?? option.label}
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
                    placeholder={t("auditLogPage.filters.searchPlaceholder")}
                    aria-label={t("auditLogPage.filters.searchAria")}
                />
            </div>
        </label>

        <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="btn btn-outline"
        >
            {t("auditLogPage.filters.reset")}
        </button>
    </div>
);
};

export default AuditFilters;
import { useTranslation } from "react-i18next"
import useLocaleDirection from "../../hooks/useLocaleDirection"
