import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import AuditHeader from "../../components/audit-log/AuditHeader"
import AuditFilters from "../../components/audit-log/AuditFilters"
import AuditTable from "../../components/audit-log/AuditTable"
import AuditEmptyState from "../../components/audit-log/AuditEmptyState"
import { getAuditLogs } from "../../services/api/auditService"
import useLocaleDirection from "../../hooks/useLocaleDirection"

const INITIAL_FILTERS = {
    action: "all",
    user: "all",
    dateRange: "30d",
    search: "",
}

const INITIAL_PAGINATION = {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
}

const normalizeUserOptions = (logs) => {
    const seen = new Map()

    logs.forEach((log) => {
        const name =
            log?.user?.fullName ??
            log?.user?.name ??
            log?.user?.displayName ??
            log?.actorName ??
            log?.actor ??
            log?.userName ??
            log?.user?.email

        if (!name || seen.has(name)) {
            return
        }

        seen.set(name, { value: name, label: name })
    })

    return Array.from(seen.values())
}

const normalizeAuditLogResponse = (response) => {
    if (!response) {
        return { logs: [], meta: INITIAL_PAGINATION }
    }

    return {
        logs: response.logs ?? [],
        meta: {
            ...INITIAL_PAGINATION,
            ...(response.meta ?? {}),
        },
    }
}

const getErrorMessage = (error, fallbackMessage) => {
    return (
        error?.response?.data?.message ??
        error?.message ??
        fallbackMessage
    )
}

const AuditLogPage = () => {
    const { t } = useTranslation()
    const { dir, isRtl } = useLocaleDirection()
    const [filters, setFilters] = useState(INITIAL_FILTERS)
    const [logs, setLogs] = useState([])
    const [pagination, setPagination] = useState(INITIAL_PAGINATION)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const userOptions = useMemo(() => normalizeUserOptions(logs), [logs])

    useEffect(() => {
        let isMounted = true

        const loadAuditLogs = async () => {
            setLoading(true)
            setError("")
            setLogs([])

            try {
                const response = await getAuditLogs({
                    page: pagination.page || 1,
                    limit: pagination.pageSize || INITIAL_PAGINATION.pageSize,
                    pageSize: pagination.pageSize || INITIAL_PAGINATION.pageSize,
                    action: filters.action !== "all" ? filters.action : undefined,
                    user: filters.user !== "all" ? filters.user : undefined,
                    dateRange: filters.dateRange !== "all" ? filters.dateRange : undefined,
                    search: filters.search.trim() || undefined,
                })

                if (!isMounted) {
                    return
                }

                const normalized = normalizeAuditLogResponse(response)

                setLogs(normalized.logs)
                setPagination((current) => ({
                    ...current,
                    ...normalized.meta,
                }))
            } catch (requestError) {
                if (!isMounted) {
                    return
                }

                setLogs([])
                setPagination(INITIAL_PAGINATION)
                setError(getErrorMessage(requestError, t("auditLogPage.failedLoad")))
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadAuditLogs()

        return () => {
            isMounted = false
        }
    }, [filters, pagination.page, pagination.pageSize])

    const handleFilterChange = (field, value) => {
        setPagination((current) => ({
            ...current,
            page: 1,
        }))

        setFilters((current) => ({
            ...current,
            [field]: value,
        }))
    }

    const handleResetFilters = () => {
        setPagination((current) => ({
            ...current,
            page: 1,
        }))

        setFilters(INITIAL_FILTERS)
    }

    const handlePageChange = (page) => {
        setPagination((current) => {
            const nextPage = Math.max(1, Number(page || 1))

            if (current.page === nextPage) {
                return current
            }

            return {
                ...current,
                page: nextPage,
            }
        })
    }

    const hasLogs = logs.length > 0

return (
    <main className={`audit-content ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
        <div className="audit-max">
            <AuditHeader />
            <AuditFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                userOptions={userOptions}
                loading={loading}
            />

            {error ? (
                <div className="security-section form-error">
                    {error}
                </div>
            ) : null}

            {!loading && !error && !hasLogs ? (
                <AuditEmptyState />
            ) : (
                <AuditTable
                    logs={logs}
                    pagination={pagination}
                    currentPage={pagination.page}
                    onPageChange={handlePageChange}
                    loading={loading}
                />
            )}
        </div>
    </main>
);
};

export default AuditLogPage
