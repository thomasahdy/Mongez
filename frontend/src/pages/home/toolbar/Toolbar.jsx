import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";
import { useBoard } from "../../../hooks/api/useBoards";
import { useCreateBoardTaskMutation } from "../../../hooks/useDashboardQueries";

function Toolbar() {
  const { boardId: routeBoardId } = useParams();
  const { activeBoard } = useAppContext();
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const boardId = routeBoardId || activeBoard?.id;
  const boardQuery = useBoard(boardId);
  const createTaskMutation = useCreateBoardTaskMutation();
  const boardName = useMemo(() => activeBoard?.name || t("toolbar.boardTools"), [activeBoard?.name, t]);

  const handleCreateTask = async () => {
    if (!boardId) {
      setError(t("toolbar.selectBoard"));
      return;
    }

    const title = window.prompt(t("toolbar.promptTitle"));

    if (!title?.trim()) {
      return;
    }

    try {
      setCreating(true);
      setError("");
      const board = boardQuery.data || activeBoard;
      if (!board) {
        throw new Error(t("toolbar.boardLoading"));
      }

      await createTaskMutation.mutateAsync({ board, taskData: { title: title.trim() } });
    } catch (createError) {
      setError(createError.message || t("toolbar.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t("toolbar.context")}</div>
          <div className="text-sm font-semibold text-slate-800">{boardName}</div>
        </div>

        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-rose-600">{error}</span>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <i className="fa-solid fa-rotate-right mr-1.5 text-[12px]" />
            {t("toolbar.refresh")}
          </button>
          <button
            type="button"
            onClick={handleCreateTask}
            disabled={creating}
            className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus mr-1.5" />
            {creating ? t("toolbar.creating") : t("toolbar.newTask")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
