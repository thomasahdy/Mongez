import React from "react";
import { useTranslation } from "react-i18next";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const PerformerRow = ({ performer, rank }) => {
  const { t } = useTranslation();
  const { dir } = useLocaleDirection();
  const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
  const rankIcons  = ["fa-trophy", "fa-medal", "fa-medal"];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-700/60 last:border-none last:pb-0" dir={dir}>
      {/* Rank */}
      <span className={`text-[12px] w-5 text-center ${rankColors[rank] ?? "text-slate-300"}`}>
        {rank < 3
          ? <i className={`fa-solid ${rankIcons[rank]}`} aria-label={t("reportsPage.rank", { count: rank + 1 })} />
          : <span className="text-slate-400 text-[11px]">{rank + 1}</span>
        }
      </span>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
        style={{ background: performer.color }}
        aria-hidden="true"
      >
        {performer.initials}
      </div>

      {/* Name */}
      <p className="flex-1 text-[14px] font-semibold text-slate-700 dark:text-slate-200 truncate">
        {performer.name}
      </p>

      {/* Task count */}
      <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800 dark:text-slate-100 shrink-0">
        {performer.tasks}
        <i className="fa-solid fa-check text-[10px] text-emerald-500" aria-label={t("reportsPage.tasksCompleted")} />
      </div>
    </div>
  );
}

export default PerformerRow
