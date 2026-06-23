import { useEffect, useMemo } from "react";

import { useOutletContext, useParams } from "react-router";


import ViewTabs from "../home/viewtabs/ViewTabs";
import Toolbar from "../home/toolbar/Toolbar";
import { useBoardTasksQuery } from "../../hooks/useTaskListQueries";
import { normalizeTaskList } from "../../lib/taskMappers";



const STATUS_COLUMNS = [
  { key: "TODO", label: "To Do", icon: "fa-regular fa-circle", color: "#ef4444" },
  { key: "IN_PROGRESS", label: "In Progress", icon: "fa-solid fa-spinner", color: "#00a8e8" },
  { key: "WAITING", label: "Waiting", icon: "fa-solid fa-pause", color: "#f59e0b" },
  { key: "DONE", label: "Done", icon: "fa-solid fa-check-circle", color: "#10b981" },
];

function normalizeStatus(task) {
  const rawStatus = String(task.status || task.statusId || task.column?.name || "TODO").toUpperCase();
  if (rawStatus.includes("DONE") || rawStatus.includes("COMPLETE")) return "DONE";
  if (rawStatus.includes("PROGRESS")) return "IN_PROGRESS";
  if (rawStatus.includes("WAIT") || rawStatus.includes("BLOCK")) return "WAITING";
  return "TODO";
}

function TaskCard({ task }) {
  const assigneeName = typeof task.assignee === "string" ? task.assignee : task.assignee?.name || task.assigneeName || "";
  const initials = assigneeName ? assigneeName.slice(0, 2).toUpperCase() : "A";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{task.title || task.name || "Untitled task"}</h3>
        {task.priority && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            {task.priority}
          </span>
        )}
      </div>

      {(task.description || task.comment) && (
        <p className="mb-3 line-clamp-2 text-xs leading-5 text-slate-500">{task.description || task.comment}</p>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {assigneeName && (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                {initials}
              </span>
              <span className="max-w-[110px] truncate">{assigneeName}</span>
            </>
          )}
        </div>
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
            <i className="fa-regular fa-calendar" />
            {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </article>
  );
}

export default function RedesignView() {
  const { boardId } = useParams();
  const { activeBoard, setPath } = useOutletContext() || {};
  const boardIdValue = boardId || activeBoard?.id || "";

  const tasksQuery = useBoardTasksQuery(boardIdValue);
  const tasks = tasksQuery.data || [];
  const loading = tasksQuery.isLoading || tasksQuery.isFetching;
  const error = tasksQuery.error?.message || "";


  useEffect(() => {
    setPath?.([
      { name: activeBoard?.space?.name || "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: activeBoard?.name || "Board", color: "text-slate-800", ref: "" },
    ]);
  }, [activeBoard?.name, activeBoard?.space?.name, setPath]);




  const groupedTasks = useMemo(() => {
    return STATUS_COLUMNS.reduce((groups, column) => {
      groups[column.key] = [];
      return groups;
    }, {});
  }, []);

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
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <ViewTabs />
      <Toolbar />

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!boardIdValue ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
            Select a board to open the board view.
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading board...</div>
        ) : (
          <div className="flex h-full min-w-[980px] gap-4">
            {STATUS_COLUMNS.map((column) => {
              const columnTasks = tasksByStatus[column.key] || groupedTasks[column.key] || [];

              return (
                <section key={column.key} className="flex min-w-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-slate-100/70">
                  <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                    <i className={column.icon} style={{ color: column.color }} />
                    <h2 className="flex-1 text-sm font-black uppercase tracking-wide text-slate-700">{column.label}</h2>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{columnTasks.length}</span>
                  </header>

                  <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    {columnTasks.length ? (
                      columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-center text-xs text-slate-400">
                        No tasks in {column.label}.
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
