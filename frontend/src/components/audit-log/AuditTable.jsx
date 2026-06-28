import AuditTableRow from "./AuditTableRow";
import AuditPagination from "./AuditPagination";

const AuditTable = ({
    logs = [],
    pagination,
    currentPage = 1,
    onPageChange,
    loading = false,
}) => {
return (
    <div className="audit-table-wrap">
        <table className="audit-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                    <th>IP Address</th>
                    <th>Timestamp</th>
                </tr>
            </thead>

            <tbody>
                {logs.map((log, index) => (
                    <AuditTableRow key={log.id ?? `${log.entityId ?? "log"}-${log.timestamp ?? index}`} log={log} />
                ))}

                {loading ? (
                    <tr>
                        <td style={{ textAlign: "center", padding: 32 }} colSpan={6}>
                            Loading audit logs...
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>

        <AuditPagination
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={onPageChange}
        />
    </div>
);
};

export default AuditTable;
