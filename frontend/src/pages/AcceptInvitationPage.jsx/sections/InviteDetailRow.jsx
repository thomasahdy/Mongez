import React from "react";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const InviteDetailRow = ({ label, value, children }) => {
  const { isRTL } = useLocaleDirection();

  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 py-2 text-[13px] first:pt-0 last:border-none last:pb-0 dark:border-slate-700 ${
        isRTL ? "flex-row-reverse" : ""
      }`}
    >
      <span className="font-medium text-slate-400 dark:text-slate-500">{label}</span>
      {children ?? <span className="font-semibold text-slate-800 dark:text-slate-100">{value}</span>}
    </div>
  );
};

export default InviteDetailRow;
