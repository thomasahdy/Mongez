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
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[960px]">
            <thead className="bg-gray-50 text-left text-sm font-semibold text-gray-600">
                <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Timestamp</th>
                </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
                {logs.map((log, index) => (
                    <AuditTableRow key={log.id ?? `${log.entityId ?? "log"}-${log.timestamp ?? index}`} log={log} />
                ))}

                {loading ? (
                    <tr>
                        <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                            Loading audit logs...
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>

        <div className="border-t border-gray-200 bg-white px-4 py-3">
            <AuditPagination
                pagination={pagination}
                currentPage={currentPage}
                onPageChange={onPageChange}
            />
        </div>
    </div>
);
};

export default AuditTable;
