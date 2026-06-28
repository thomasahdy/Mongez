import React from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import BoardChip from "./BoardChip";

const BoardChips = ({ boards, onAddBoard }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <div className={`mt-2.5 flex flex-wrap gap-2 ${isRTL ? "pr-[52px]" : "pl-[52px]"}`} role="list" aria-label={t("spacesPage.boardsAria")}>
      {boards.map((board) => (
        <div key={board.id} role="listitem">
          <BoardChip board={board} />
        </div>
      ))}
      <button
        onClick={onAddBoard}
        className="flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-400 transition-all duration-150 hover:border-sky-400 hover:bg-sky-50/50 hover:text-sky-500 dark:border-slate-600 dark:hover:bg-sky-900/20"
        aria-label={t("spacesPage.addNewBoard")}
      >
        <i className="fa-solid fa-plus text-[11px]" />
        {t("spacesPage.addBoard")}
      </button>
    </div>
  );
};

export default BoardChips;
