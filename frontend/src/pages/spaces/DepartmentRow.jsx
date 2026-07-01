import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import StatItem from "../../components/ui/StatItem";
import BoardChips from "./BoardChips";
import CreateBoardModal from "./CreateBoardModal";
import { useCreateBoard } from "../../hooks/api/useBoards";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/errorMessage";

const DepartmentRow = ({ dept }) => {
  const { t } = useTranslation();
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const createBoard = useCreateBoard();
  const toast = useToast();

  const handleCreateBoard = async (data) => {
    try {
      await createBoard.mutateAsync(data);
      toast.success(t("spacesPage.boardCreated"));
      setShowCreateBoardModal(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t("spacesPage.createBoardFailed")));
    }
  };

  return (
    <div>
      <div
        className="group mt-2.5 flex cursor-pointer items-center gap-4 rounded-lg border border-slate-200 px-4 py-3.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-slate-600"
        role="button"
        tabIndex={0}
        aria-label={t("spacesPage.departmentAria", { name: dept.name })}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.click()}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dept.iconBg}`}>
          <i className={`fa-solid ${dept.icon} text-[15px] ${dept.iconColor}`} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">{dept.name}</p>
          <p className="truncate text-[12px] text-slate-400 dark:text-slate-500">
            {t("spacesPage.lead", { lead: dept.lead })} · {t("spacesPage.membersShort", { count: dept.memberCount })}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400 sm:flex">
          <StatItem icon="fa-table-columns" label={t("spacesPage.boardCount", { count: dept.stats.boards })} />
          <StatItem icon="fa-list-check" label={t("spacesPage.taskCount", { count: dept.stats.tasks })} />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setShowCreateBoardModal(true);
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={t("spacesPage.addBoardTo", { name: dept.name })}
        >
          <i className="fa-solid fa-plus" /> {t("spacesPage.addBoard")}
        </Button>
      </div>

      {dept.boards.length > 0 ? <BoardChips boards={dept.boards} onAddBoard={() => setShowCreateBoardModal(true)} /> : null}

      {showCreateBoardModal ? (
        <CreateBoardModal
          onSubmit={handleCreateBoard}
          onClose={() => setShowCreateBoardModal(false)}
          dept={dept}
        />
      ) : null}
    </div>
  );
};

export default DepartmentRow;
