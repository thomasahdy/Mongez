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
    <div className="audit-pagination">
        <p className="page-info">
            Showing {start}-{end} of {total} entries
        </p>

        <div className="page-btns">
            <button
                type="button"
                onClick={() => onPageChange?.(page - 1)}
                disabled={!canGoPrevious}
                className="page-btn"
                aria-label="Previous page"
            >
                <i className="fa-solid fa-chevron-left"></i>
            </button>

            {pages.map((item, index) =>
                item === "..." ? (
                    <span
                        key={`ellipsis-${index}`}
                        className="page-btn"
                        aria-hidden="true"
                    >
                        ...
                    </span>
                ) : (
                    <button
                        type="button"
                        key={item}
                        onClick={() => onPageChange?.(item)}
                        className={`page-btn ${item === page ? "active" : ""}`}
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
                className="page-btn"
                aria-label="Next page"
            >
                <i className="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    </div>
);
};

export default AuditPagination;
