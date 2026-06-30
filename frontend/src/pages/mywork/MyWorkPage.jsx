import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import StatCard from "../../components/mywork/StatCard";
import CompletionStreak from "./sections/CompletionStreak";
import MiniCalendar from "./sections/MiniCalendar";
import FocusBanner from "./sections/FocusBanner";
import TaskSection from "./sections/TaskSection";
import { useQueryClient } from "@tanstack/react-query";
import { useMyWorkTasks, useUpdateTask } from "../../hooks/api/useTasks";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

function toDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeCompletionHistoryEntries(myWorkData) {
  const candidates = [
    myWorkData?.completionHistory,
    myWorkData?.completedHistory,
    myWorkData?.activityHistory,
  ];

  return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function buildRecentCompletionDays(historyEntries) {
  const completionKeys = new Set(
    historyEntries
      .map((entry) => entry?.date || entry?.completedAt || entry?.day || entry)
      .map((value) => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? "" : toDayKey(parsed);
      })
      .filter(Boolean),
  );

  const today = new Date();
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const currentDay = new Date(today);
    currentDay.setDate(today.getDate() - offset);
    days.push(completionKeys.has(toDayKey(currentDay)));
  }

  return days;
}

function calculateCurrentStreak(days) {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (!days[index]) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function calculateBestStreak(days) {
  let best = 0;
  let current = 0;

  days.forEach((done) => {
    if (done) {
      current += 1;
      best = Math.max(best, current);
      return;
    }

    current = 0;
  });

  return best;
}

export default function MyWorkPage({ setPath }) {
  const { t } = useTranslation();
  const { isRTL, locale } = useLocaleDirection();
  const queryClient = useQueryClient();
  const { data: myWorkData, isLoading, isError, error } = useMyWorkTasks();
  const updateTaskMutation = useUpdateTask();
  const [completedIds, setCompletedIds] = useState(new Set());

  useEffect(() => {
    setPath?.([
      { name: t("common.workspace"), color: "text-slate-400", ref: "" },
      { name: t("myWorkPage.breadcrumb"), color: "text-slate-800", ref: "" },
    ]);
  }, [setPath, t]);

  const mapBackendTask = useCallback((task, sectionKey) => {
    const priorityColors = {
      URGENT: "#ef4444",
      HIGH: "#ef4444",
      MEDIUM: "#f59e0b",
      LOW: "#00a8e8",
      NONE: "#cbd5e1",
    };

    let dueLabel = t("myWorkPage.noDueValue");
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const today = new Date();
      const diffTime = d.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        dueLabel = diffDays === -1 ? t("myWorkPage.yesterday") : t("myWorkPage.overdueDays", { count: Math.abs(diffDays) });
      } else if (diffDays === 0) {
        dueLabel = t("myWorkPage.today");
      } else {
        dueLabel = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
      }
    }

    return {
      id: task.id,
      section: sectionKey,
      name: task.title,
      project: task.board?.department?.name || task.board?.name || t("common.workspace"),
      due: dueLabel,
      priorityColor: priorityColors[task.priority] || "#cbd5e1",
    };
  }, [locale, t]);

  const handleComplete = useCallback(async (id) => {
    const isCurrentlyCompleted = completedIds.has(id);
    const newStatus = isCurrentlyCompleted ? "TODO" : "DONE";

    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    try {
      await updateTaskMutation.mutateAsync({
        taskId: id,
        data: { status: newStatus },
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", "mywork"] });
    } catch (err) {
      console.error("Failed to update task completion status:", err);
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyCompleted) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    }
  }, [completedIds, queryClient, updateTaskMutation]);

  const overdueTasks = useMemo(() => (myWorkData?.overdue || []).map((task) => mapBackendTask(task, "overdue")), [mapBackendTask, myWorkData]);
  const todayTasks = useMemo(() => (myWorkData?.today || []).map((task) => mapBackendTask(task, "today")), [mapBackendTask, myWorkData]);
  const upcomingTasks = useMemo(() => (myWorkData?.upcoming || []).map((task) => mapBackendTask(task, "upcoming")), [mapBackendTask, myWorkData]);
  const noDueDateTasks = useMemo(() => (myWorkData?.noDueDate || []).map((task) => mapBackendTask(task, "noDueDate")), [mapBackendTask, myWorkData]);
  const rawTasks = useMemo(
    () =>
      [
        ...(myWorkData?.overdue || []),
        ...(myWorkData?.today || []),
        ...(myWorkData?.upcoming || []),
        ...(myWorkData?.noDueDate || []),
      ].filter((task, index, collection) => collection.findIndex((item) => item.id === task.id) === index),
    [myWorkData],
  );
  const taskDayKeys = useMemo(
    () =>
      new Set(
        rawTasks
          .map((task) => task?.dueDate)
          .filter(Boolean)
          .map((value) => {
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? "" : toDayKey(parsed);
          })
          .filter(Boolean),
      ),
    [rawTasks],
  );
  const completionHistory = useMemo(() => normalizeCompletionHistoryEntries(myWorkData), [myWorkData]);
  const completionDays = useMemo(() => buildRecentCompletionDays(completionHistory), [completionHistory]);
  const hasCompletionHistory = completionHistory.length > 0;
  const completionStreak = useMemo(() => calculateCurrentStreak(completionDays), [completionDays]);
  const bestCompletionStreak = useMemo(() => calculateBestStreak(completionDays), [completionDays]);

  const tasksBySection = useMemo(() => ({
    overdue: overdueTasks,
    today: todayTasks,
    upcoming: upcomingTasks,
    noDueDate: noDueDateTasks,
  }), [noDueDateTasks, overdueTasks, todayTasks, upcomingTasks]);

  const stats = useMemo(() => [
    { value: myWorkData?.stats?.overdueCount ?? 0, label: t("myWorkPage.overdue"), color: "text-red-500" },
    { value: myWorkData?.stats?.todayCount ?? 0, label: t("myWorkPage.dueToday"), color: "text-amber-500" },
    { value: myWorkData?.stats?.thisWeekCount ?? 0, label: t("myWorkPage.thisWeek"), color: "text-sky-500" },
    { value: myWorkData?.stats?.completedCount ?? 0, label: t("myWorkPage.completed"), color: "text-emerald-500" },
  ], [myWorkData, t]);

  const criticalTask = useMemo(
    () => overdueTasks.find((task) => !completedIds.has(task.id))
      ?? todayTasks.find((task) => !completedIds.has(task.id))
      ?? upcomingTasks[0]
      ?? noDueDateTasks.find((task) => !completedIds.has(task.id))
      ?? null,
    [completedIds, noDueDateTasks, overdueTasks, todayTasks, upcomingTasks]
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-500">{t("myWorkPage.loading")}</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 max-w-md">
          <h3 className="font-bold text-lg mb-2">{t("myWorkPage.failedTitle")}</h3>
          <p className="text-sm">{error?.message || t("myWorkPage.unavailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className={`flex-1 overflow-y-auto px-6 py-6 ${isRTL ? "text-right" : "text-left"}`} aria-label={t("myWorkPage.aria")}>
          <div className="max-w-[1200px] mx-auto">
            <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
              <i className="fa-solid fa-circle-check text-indigo-500" aria-hidden="true" />
              {t("myWorkPage.title")}
            </h1>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-5">
              {t("myWorkPage.greeting", { dueToday: stats[1].value, overdue: stats[0].value })}
            </p>

            {criticalTask ? (
              <FocusBanner
                criticalTask={criticalTask}
                onFocusStart={() => console.info("Focus mode started for:", criticalTask.id)}
              />
            ) : null}

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" aria-label={t("myWorkPage.summaryAria")}>
              {stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  color={stat.color}
                />
              ))}
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
              <div>
                {["overdue", "today", "upcoming", "noDueDate"].map((sectionKey) => (
                  <TaskSection
                    key={sectionKey}
                    sectionKey={sectionKey}
                    tasks={tasksBySection[sectionKey]}
                    completedIds={completedIds}
                    onComplete={handleComplete}
                  />
                ))}
              </div>

              <aside aria-label={t("myWorkPage.workSidebar")}>
                <MiniCalendar taskDays={taskDayKeys} />
                <CompletionStreak
                  streak={completionStreak}
                  bestStreak={bestCompletionStreak}
                  days={completionDays}
                  historyAvailable={hasCompletionHistory}
                  totalCompleted={myWorkData?.stats?.completedCount ?? 0}
                />
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
