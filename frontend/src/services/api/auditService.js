import apiClient from "./apiClient";

const toPositiveNumber = (value, fallback) => {
    const parsed = Number(value)

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeAuditLogsResponse = (data) => {
    if (Array.isArray(data)) {
        return {
            logs: data,
            meta: {
                total: data.length,
                page: 1,
                pageSize: data.length || 10,
                totalPages: data.length ? 1 : 0,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        }
    }

    const logs =
        data?.logs ??
        data?.items ??
        data?.data ??
        data?.results ??
        []

    const metaSource = data?.meta ?? data?.pagination ?? data?.pageInfo ?? {}
    const page = toPositiveNumber(metaSource.page ?? data?.page, 1)
    const pageSize = toPositiveNumber(
        metaSource.pageSize ??
            metaSource.limit ??
            data?.pageSize ??
            (Array.isArray(logs) && logs.length > 0 ? logs.length : 10),
        10
    )
    const total = Math.max(0, Number(metaSource.total ?? data?.total ?? logs.length) || 0)
    const totalPagesFromApi = Number(metaSource.totalPages ?? data?.totalPages)
    const totalPages = Number.isFinite(totalPagesFromApi) && totalPagesFromApi >= 0
        ? totalPagesFromApi
        : total > 0
            ? Math.max(1, Math.ceil(total / pageSize))
            : 0

    return {
        logs,
        meta: {
            total,
            page,
            pageSize,
            totalPages,
            hasNextPage:
                metaSource.hasNextPage ??
                (page < totalPages),
            hasPreviousPage:
                metaSource.hasPreviousPage ??
                (page > 1),
        },
    }
}

export const getAuditLogs = async (params = {}, config = {}) => {
    const { data } = await apiClient.get("/audit-logs", {
        params,
        ...config,
    })

    return normalizeAuditLogsResponse(data)
};

export const getAuditLogById = async (id) => {
    const { data } = await apiClient.get(`/audit-logs/${id}`);

    return data;
};
