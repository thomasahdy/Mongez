import { useEffect } from "react";
import AuditLogPage from "../audit-log/AuditLogPage";
import SettingsSidebar from "./sections/SettingsSidebar";

const auditPath = [
  { name: "Settings", color: "text-slate-400", ref: "/settings" },
  { name: "Audit Log", color: "text-slate-800", ref: "/settings/audit-log" },
];

export default function SettingsAuditLogPage({ setPath }) {
  useEffect(() => {
    setPath?.(auditPath);
  }, [setPath]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId="audit" />
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950" aria-label="Audit log settings">
        <AuditLogPage />
      </main>
    </div>
  );
}
