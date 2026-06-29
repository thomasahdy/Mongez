import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useOutletContext } from "react-router";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { useBoardTasksQuery } from "../../hooks/useTaskListQueries";
import Toolbar from "../home/toolbar/Toolbar";
import ViewTabs from "../home/viewtabs/ViewTabs";

export default function ListView() {
  const { boardId } = useParams();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { activeBoard } = useOutletContext() || {};
  const [groupBy, setGroupBy] = useState("status");

  const boardIdValue = boardId || activeBoard?.id;
  const tasksQuery = useBoardTasksQuery(boardIdValue);
  const tasks = useMemo(() => tasksQuery.data || [], [tasksQuery.data]);
  const loading = tasksQuery.isLoading || tasksQuery.isFetching;
  const error = tasksQuery.error?.message || null;
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";

  const groupedTasks = useMemo(() => {
    const grouped = {};

    tasks.forEach((task) => {
      let key;

      if (groupBy === "status") {
        key = task.status?.toUpperCase() || task.statusId?.toUpperCase() || "TODO";
      } else if (groupBy === "assignee") {
        key = typeof task.assignee === "string" ? task.assignee : task.assignee?.name || t("legacyListView.unassigned");
      } else if (groupBy === "priority") {
        key = task.priority || t("legacyListView.normal");
      } else {
        key = t("legacyListView.allTasks");
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(task);
    });

    return grouped;
  }, [groupBy, t, tasks]);

  const getStatusColor = (status) => {
    const colors = {
      TODO: { dot: "#ef4444", badge: "bg-red-100 text-red-700" },
      IN_PROGRESS: { dot: "#00a8e8", badge: "bg-blue-100 text-blue-700" },
      WAITING: { dot: "#ea580c", badge: "bg-orange-100 text-orange-700" },
      DONE: { dot: "#10b981", badge: "bg-green-100 text-green-700" },
    };
    const statusUpper = status?.toUpperCase() || "TODO";
    return colors[statusUpper] || colors.TODO;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      HIGH: { badge: "bg-red-100 text-red-700" },
      MEDIUM: { badge: "bg-yellow-100 text-yellow-700" },
      LOW: { badge: "bg-slate-100 text-slate-700" },
    };
    const priorityUpper = priority?.toUpperCase() || "MEDIUM";
    return colors[priorityUpper] || colors.MEDIUM;
  };

  const getGroupColor = (groupKey) => {
    if (groupBy === "status") {
      return getStatusColor(groupKey).dot;
    }
    if (groupBy === "priority") {
      const colorMap = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#94a3b8" };
      return colorMap[groupKey] || "#94a3b8";
    }
    return "#94a3b8";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50" dir={isRTL ? "rtl" : "ltr"}>
      <ViewTabs />
      <Toolbar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <label className="text-sm font-semibold text-slate-700">{t("legacyListView.groupBy")}</label>
          <select
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value)}
            className={`px-3 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${isRTL ? "text-right" : "text-left"}`}
          >
            <option value="status">{t("legacyListView.status")}</option>
            <option value="assignee">{t("legacyListView.assignee")}</option>
            <option value="priority">{t("legacyListView.priority")}</option>
            <option value="none">{t("legacyListView.none")}</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">{t("legacyListView.loading")}</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
                <div key={groupKey} className="bg-white border-b border-slate-200">
                  <div className={`px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 sticky top-0 z-10 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getGroupColor(groupKey) }} />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{groupKey}</span>
                    <span className={`text-xs text-slate-500 ${isRTL ? "mr-auto" : "ml-auto"}`}>
                      ({groupTasks.length} {t(`legacyListView.task_${groupTasks.length === 1 ? "one" : "other"}`)})
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {groupTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`px-4 py-3 hover:bg-sky-50 transition-colors cursor-pointer ${isRTL ? "border-r-4 border-r-transparent hover:border-r-sky-500" : "border-l-4 border-l-transparent hover:border-l-sky-500"}`}
                      >
                        <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: getStatusColor(task.status || task.statusId).dot }} />
                          <div className="flex-1 min-w-0">
                            <div className={`flex items-center gap-2 mb-1 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {task.title || task.name || t("legacyListView.untitled")}
                              </h4>
                              {task.priority ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(task.priority).badge}`}>{task.priority}</span> : null}
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(task.status || task.statusId).badge}`}>
                                {(task.status || task.statusId)?.toUpperCase() || "TODO"}
                              </span>
                            </div>

                            {task.description || task.comment ? (
                              <p className="text-xs text-slate-600 mb-2 line-clamp-2">{task.description || task.comment}</p>
                            ) : null}

                            <div className={`flex items-center gap-4 text-xs text-slate-500 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                              {task.dueDate ? (
                                <span className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                                  <i className="fas fa-calendar-alt" style={{ fontSize: "10px" }}></i>
                                  {new Date(task.dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                                </span>
                              ) : null}
                              {task.progress !== undefined ? (
                                <span className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                                  <i className="fas fa-chart-pie" style={{ fontSize: "10px" }}></i>
                                  {task.progress}%
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {task.assignee ? (
                            <div
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold"
                              title={typeof task.assignee === "string" ? task.assignee : task.assignee?.name}
                            >
                              {(typeof task.assignee === "string" ? task.assignee : task.assignee?.name || "").substring(0, 2).toUpperCase() || "A"}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {tasks.length === 0 && !loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">{t("legacyListView.noTasks")}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
