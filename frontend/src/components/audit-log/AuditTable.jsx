import AuditTableRow from "./AuditTableRow";
import AuditPagination from "./AuditPagination";
import { useTranslation } from "react-i18next";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const AuditTable = ({
    logs = [],
    pagination,
    currentPage = 1,
    onPageChange,
    loading = false,
}) => {
    const { t } = useTranslation();
    const { dir } = useLocaleDirection();
return (
    <div className="audit-table-wrap" dir={dir}>
        <table className="audit-table">
            <thead>
                <tr>
                    <th>{t("auditLogPage.table.user")}</th>
                    <th>{t("auditLogPage.table.action")}</th>
                    <th>{t("auditLogPage.table.resource")}</th>
                    <th>{t("auditLogPage.table.details")}</th>
                    <th>{t("auditLogPage.table.ipAddress")}</th>
                    <th>{t("auditLogPage.table.timestamp")}</th>
                </tr>
            </thead>

            <tbody>
                {logs.map((log, index) => (
                    <AuditTableRow key={log.id ?? `${log.entityId ?? "log"}-${log.timestamp ?? index}`} log={log} />
                ))}

                {loading ? (
                    <tr>
                        <td style={{ textAlign: "center", padding: 32 }} colSpan={6}>
                            {t("auditLogPage.table.loading")}
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
