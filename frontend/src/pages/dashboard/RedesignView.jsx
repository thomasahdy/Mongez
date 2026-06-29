import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext, useParams } from "react-router";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { useBoardTasksQuery } from "../../hooks/useTaskListQueries";
import Toolbar from "../home/toolbar/Toolbar";
import ViewTabs from "../home/viewtabs/ViewTabs";

const STATUS_COLUMNS = [
  { key: "TODO", icon: "fa-regular fa-circle", color: "#ef4444" },
  { key: "IN_PROGRESS", icon: "fa-solid fa-spinner", color: "#00a8e8" },
  { key: "WAITING", icon: "fa-solid fa-pause", color: "#f59e0b" },
  { key: "DONE", icon: "fa-solid fa-check-circle", color: "#10b981" },
];

function normalizeStatus(task) {
  const rawStatus = String(task.status || task.statusId || task.column?.name || "TODO").toUpperCase();
  if (rawStatus.includes("DONE") || rawStatus.includes("COMPLETE")) return "DONE";
  if (rawStatus.includes("PROGRESS")) return "IN_PROGRESS";
  if (rawStatus.includes("WAIT") || rawStatus.includes("BLOCK")) return "WAITING";
  return "TODO";
}

function TaskCard({ task, locale, t, isRTL }) {
  const assigneeName = typeof task.assignee === "string" ? task.assignee : task.assignee?.name || task.assigneeName || "";
  const initials = assigneeName ? assigneeName.slice(0, 2).toUpperCase() : "A";

  return (
    <article className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md ${isRTL ? "text-right" : "text-left"}`}>
      <div className={`mb-2 flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{task.title || task.name || t("legacyRedesignView.untitledTask")}</h3>
        {task.priority ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            {task.priority}
          </span>
        ) : null}
      </div>

      {task.description || task.comment ? (
        <p className="mb-3 line-clamp-2 text-xs leading-5 text-slate-500">{task.description || task.comment}</p>
      ) : null}

      <div className={`flex items-center justify-between gap-3 text-xs text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {assigneeName ? (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                {initials}
              </span>
              <span className="max-w-[110px] truncate">{assigneeName}</span>
            </>
          ) : null}
        </div>
        {task.dueDate ? (
          <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 ${isRTL ? "flex-row-reverse" : ""}`}>
            <i className="fa-regular fa-calendar" />
            {new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function RedesignView() {
  const { boardId } = useParams();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { activeBoard, setPath } = useOutletContext() || {};
  const boardIdValue = boardId || activeBoard?.id || "";
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";

  const tasksQuery = useBoardTasksQuery(boardIdValue);
  const tasks = useMemo(() => tasksQuery.data || [], [tasksQuery.data]);
  const loading = tasksQuery.isLoading || tasksQuery.isFetching;
  const error = tasksQuery.error?.message || "";

  useEffect(() => {
    setPath?.([
      { name: activeBoard?.space?.name || t("legacyRedesignView.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: activeBoard?.name || t("legacyRedesignView.board"), color: "text-slate-800", ref: "" },
    ]);
  }, [activeBoard?.name, activeBoard?.space?.name, setPath, t]);

  const groupedTasks = useMemo(
    () =>
      STATUS_COLUMNS.reduce((groups, column) => {
        groups[column.key] = [];
        return groups;
      }, {}),
    [],
  );

  const tasksByStatus = useMemo(() => {
    const nextGroups = STATUS_COLUMNS.reduce((groups, column) => {
      groups[column.key] = [];
      return groups;
    }, {});

    tasks.forEach((task) => {
      const status = normalizeStatus(task);
      nextGroups[status]?.push(task);
    });

    return nextGroups;
  }, [tasks]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      <ViewTabs />
      <Toolbar />

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {!boardIdValue ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
            {t("legacyRedesignView.selectBoard")}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">{t("legacyRedesignView.loading")}</div>
        ) : (
          <div className={`flex h-full min-w-[980px] gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            {STATUS_COLUMNS.map((column) => {
              const columnTasks = tasksByStatus[column.key] || groupedTasks[column.key] || [];
              const columnLabel = t(`legacyRedesignView.statuses.${column.key}`);

              return (
                <section key={column.key} className="flex min-w-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-slate-100/70">
                  <header className={`flex items-center gap-2 border-b border-slate-200 px-4 py-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <i className={column.icon} style={{ color: column.color }} />
                    <h2 className="flex-1 text-sm font-black uppercase tracking-wide text-slate-700">{columnLabel}</h2>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{columnTasks.length}</span>
                  </header>

                  <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    {columnTasks.length ? (
                      columnTasks.map((task) => <TaskCard key={task.id} task={task} locale={locale} t={t} isRTL={isRTL} />)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-center text-xs text-slate-400">
                        {t("legacyRedesignView.noTasksInColumn", { column: columnLabel })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
