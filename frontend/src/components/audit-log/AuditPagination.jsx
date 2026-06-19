const buildPageWindow = (currentPage, totalPages) => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const window = [1]
    const left = Math.max(2, currentPage - 1)
    const right = Math.min(totalPages - 1, currentPage + 1)

    if (left > 2) {
        window.push("...")
    }

    for (let page = left; page <= right; page += 1) {
        window.push(page)
    }

    if (right < totalPages - 1) {
        window.push("...")
    }

    window.push(totalPages)

    return window
}

const AuditPagination = ({
    pagination = {},
    currentPage = 1,
    onPageChange,
}) => {
    const total = Number(pagination.total ?? 0)
    const pageSize = Number(pagination.pageSize ?? 10)
    const totalPages = Number(pagination.totalPages ?? (pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1))
    const page = Math.min(Math.max(1, Number(currentPage || pagination.page || 1)), Math.max(totalPages, 1))
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1
    const end = total === 0 ? 0 : Math.min(total, page * pageSize)
    const pages = buildPageWindow(page, totalPages)
    const canGoPrevious = page > 1
    const canGoNext = page < totalPages

return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
            Showing {start}-{end} of {total} entries
        </p>

        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onPageChange?.(page - 1)}
                disabled={!canGoPrevious}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
            >
                <i className="fa-solid fa-chevron-left"></i>
            </button>

            {pages.map((item, index) =>
                item === "..." ? (
                    <span
                        key={`ellipsis-${index}`}
                        className="flex h-9 w-9 items-center justify-center text-gray-400"
                        aria-hidden="true"
                    >
                        ...
                    </span>
                ) : (
                    <button
                        type="button"
                        key={item}
                        onClick={() => onPageChange?.(item)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition ${
                            item === page
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        }`}
                        aria-current={item === page ? "page" : undefined}
                    >
                        {item}
                    </button>
                )
            )}

            <button
                type="button"
                onClick={() => onPageChange?.(page + 1)}
                disabled={!canGoNext}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
            >
                <i className="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    </div>
);
};

export default AuditPagination;
