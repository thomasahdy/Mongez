import React, { useEffect, useState } from 'react'
import { useTranslation } from "react-i18next";
import ViewTabs from '../home/viewtabs/ViewTabs';
import Toolbar from '../home/toolbar/Toolbar';
import Board from './Board';
import TaskBoardSkeleton from '../../components/loading/TaskBoardSkeleton';
import { useParams } from 'react-router';
import { useBoard } from '../../hooks/api/useBoards';
import useLocaleDirection from '../../hooks/useLocaleDirection';
import { useAppContext } from '../../pages/AppContext';


const KanbanBoard = ({setPath}) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const [activeTab, setActiveTab] = useState("board");
  const {boardId} = useParams();
  const { activeSpace } = useAppContext();

  const {data: boardData, isLoading: boardLoading, isError: boardError, error, refetch} = useBoard(boardId);
  const {columns} = boardData || {columns: []};

  useEffect(() => {
    setPath([
      {
        name: activeSpace?.name || t("common.workspace"),
        color: "text-slate-400",
        ref: "",
      },
      {
        name: boardData?.department?.name || t("kanbanPage.breadcrumb"),
        color: "text-red-500",
        ref: "",
      },
      {
        name: boardData?.name || t("kanbanPage.breadcrumb"),
        color: "text-slate-800",
        ref: "",
      },
    ]);
  }, [activeSpace?.name, boardData?.department?.name, boardData?.name, setPath, t]);

  // ── Loading State ──
  if (boardLoading) {
    return (
      <div className={`flex flex-col h-full overflow-hidden ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
        <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <Toolbar />
        <TaskBoardSkeleton />
      </div>
    );
  }

  // ── Error State ──
  if (boardError) {
    const status = error?.response?.status;
    const message =
      status === 404
        ? t("kanbanPage.boardMissing")
        : status === 403
          ? t("kanbanPage.boardDenied")
          : error?.response?.data?.message || error?.message || t("kanbanPage.boardFailed");

    return (
      <div className={`flex flex-col h-full overflow-hidden ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
        <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <Toolbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {status === 404 ? t("kanbanPage.boardNotFound") : t("kanbanPage.boardLoadTitle")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              {t("kanbanPage.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
      <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <Toolbar />
      <Board id={boardId} columns={columns} />
    </div>
    
  );
  
}

export default KanbanBoard
