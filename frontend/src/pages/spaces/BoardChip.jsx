import React from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

const BoardChip = ({ board }) => {
  const { t } = useTranslation();
  const isArchived = board.isArchived || board.archived;
  const name = board.name || board.label || t("spacesPage.untitledBoard");

  if (isArchived) {
    return (
      <span className="flex cursor-default select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-400 line-through opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500">
        <i className={`fa-solid ${board.icon || "fa-table-columns"} text-[11px]`} aria-hidden="true" />
        {name}
        <span className="sr-only">({t("spacesPage.archived")})</span>
      </span>
    );
  }

  return (
    <Link
      to={`/board/${board.id}/kanban`}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-all duration-150 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-sky-900/20 dark:hover:text-sky-400"
    >
      <i className={`fa-solid ${board.icon || "fa-table-columns"} text-[11px] text-slate-400`} aria-hidden="true" />
      {name}
    </Link>
  );
};

export default BoardChip;
