import { useState, useCallback, useMemo, useEffect } from "react";
import ViewTabs from "../home/viewtabs/ViewTabs";
import Button from "../../components/ui/Button";
import StatCard from "../../components/mywork/StatCard";
import CompletionStreak from "./sections/CompletionStreak";
import MiniCalendar from "./sections/MiniCalendar";
import FocusBanner from "./sections/FocusBanner";
import TaskSection from "./sections/TaskSection";
import { useQueryClient } from "@tanstack/react-query";
import { useMyWorkTasks, useUpdateTask } from "../../hooks/api/useTasks";

// Helper to map backend task shape to the shape expected by TaskRow.jsx
const mapBackendTask = (t, sectionKey) => {
  const priorityColors = {
    URGENT: "#ef4444",
    HIGH: "#ef4444",
    MEDIUM: "#f59e0b",
    LOW: "#00a8e8",
    NONE: "#cbd5e1",
  };

  let dueLabel = "—";
  if (t.dueDate) {
    const d = new Date(t.dueDate);
    const today = new Date();
    const diffTime = d.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      dueLabel = diffDays === -1 ? "Yesterday" : `${Math.abs(diffDays)}d overdue`;
    } else if (diffDays === 0) {
      dueLabel = "Today";
    } else {
      dueLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  return {
    id: t.id,
    section: sectionKey,
    name: t.title,
    project: t.board?.department?.name || t.board?.name || "Workspace",
    due: dueLabel,
    priorityColor: priorityColors[t.priority] || "#cbd5e1",
  };
};

const STREAK_DAYS = [true, true, true, false, true, true, true]; // mock for now
const CALENDAR_TASK_DAYS = new Set([3, 5, 10, 19]); // mock for now

let path = [
  {
    name: "Al-Noor Foundation",
    color: "text-slate-400",
    ref: ""
  },
  {
    name: "My Work",
    color: "text-slate-800",
    ref: ""
  },
];

export default function MyWorkPage({ userName = "Teammate", setPath }) {
  const queryClient = useQueryClient();
  const { data: myWorkData, isLoading, isError, error } = useMyWorkTasks();
  const updateTaskMutation = useUpdateTask();

  useEffect(() => {
    setPath?.(path);
  }, [setPath]);

  const [completedIds, setCompletedIds] = useState(new Set());

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
      // Revert optimistic update on failure
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
  }, [completedIds, updateTaskMutation, queryClient]);

  const overdueTasks = useMemo(() => (myWorkData?.overdue || []).map(t => mapBackendTask(t, "overdue")), [myWorkData]);
  const todayTasks = useMemo(() => (myWorkData?.today || []).map(t => mapBackendTask(t, "today")), [myWorkData]);
  const upcomingTasks = useMemo(() => (myWorkData?.upcoming || []).map(t => mapBackendTask(t, "upcoming")), [myWorkData]);
  const noDueDateTasks = useMemo(() => (myWorkData?.noDueDate || []).map(t => mapBackendTask(t, "noDueDate")), [myWorkData]);

  const tasksBySection = useMemo(() => ({
    overdue: overdueTasks,
    today: todayTasks,
    upcoming: upcomingTasks,
    noDueDate: noDueDateTasks,
  }), [overdueTasks, todayTasks, upcomingTasks, noDueDateTasks]);

  const stats = useMemo(() => [
    { value: myWorkData?.stats?.overdueCount ?? 0, label: "Overdue", color: "text-red-500" },
    { value: myWorkData?.stats?.todayCount ?? 0, label: "Due Today", color: "text-amber-500" },
    { value: myWorkData?.stats?.thisWeekCount ?? 0, label: "This Week", color: "text-sky-500" },
    { value: myWorkData?.stats?.completedCount ?? 0, label: "Completed", color: "text-emerald-500" },
  ], [myWorkData]);

  const criticalTask = useMemo(() => {
    return overdueTasks.find((t) => !completedIds.has(t.id)) ?? todayTasks.find((t) => !completedIds.has(t.id)) ?? upcomingTasks[0] ?? noDueDateTasks.find((t) => !completedIds.has(t.id)) ?? null;
  }, [overdueTasks, todayTasks, upcomingTasks, noDueDateTasks, completedIds]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-500">Loading your assignments...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 max-w-md">
          <h3 className="font-bold text-lg mb-2">Failed to load My Work</h3>
          <p className="text-sm">{error?.message || "Workspace tasks are temporarily unavailable."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="My Work">
            <div className="max-w-[1200px] mx-auto">
              <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
                <i className="fa-solid fa-circle-check text-indigo-500" aria-hidden="true" />
                My Work
              </h1>
              <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-5">
                Good morning — you have {stats[1].value} tasks due today and{" "}
                {stats[0].value} overdue.
              </p>

              {criticalTask && (
                <FocusBanner
                  criticalTask={criticalTask}
                  onFocusStart={() =>
                    console.info("Focus mode started for:", criticalTask.id)
                  }
                />
              )}

              <section
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
                aria-label="Task summary statistics"
              >
                {stats.map((s) => (
                  <StatCard
                    key={s.label}
                    value={s.value}
                    label={s.label}
                    color={s.color}
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

                <aside aria-label="Work sidebar">
                  <MiniCalendar taskDays={CALENDAR_TASK_DAYS} />
                  <CompletionStreak
                    streak={7}
                    bestStreak={14}
                    days={STREAK_DAYS}
                  />
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}