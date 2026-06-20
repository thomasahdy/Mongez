/**
 * Mongez — My Work Page
 * Converted from HTML export → production-grade React + Tailwind
 *
 * Component tree:
 *  MyWorkPage
 *    ├─ GlobalSidebar
 *    ├─ TopHeader
 *    ├─ ViewTabs
 *    └─ <main>
 *         ├─ FocusBanner
 *         ├─ StatsRow → StatCard ×4
 *         └─ WorkLayout (2-col)
 *              ├─ WorkMain
 *              │    ├─ TaskSection (Overdue)   → TaskRow ×N
 *              │    ├─ TaskSection (Due Today) → TaskRow ×N
 *              │    └─ TaskSection (Upcoming)  → TaskRow ×N
 *              └─ WorkSidebar
 *                   ├─ MiniCalendar
 *                   └─ CompletionStreak → StreakDot ×7
 */
 
import { useState, useCallback, useMemo, useEffect } from "react";
import ViewTabs from "../home/viewtabs/ViewTabs";
import Button from "../../components/ui/Button";
import StatCard from "../../components/mywork/StatCard";
import CompletionStreak from "./sections/CompletionStreak";
import MiniCalendar from "./sections/MiniCalendar";
import FocusBanner from "./sections/FocusBanner";
import TaskSection from "./sections/TaskSection";
 
// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────
 
const INITIAL_TASKS = [
  // Overdue
  {
    id: "t1", section: "overdue",
    name: "Submit Curriculum Approval Doc",
    project: "Upper Egypt Edu",
    due: "Yesterday",
    priorityColor: "#ef4444",
  },
  {
    id: "t2", section: "overdue",
    name: "Prepare Q4 Impact Assessment Report",
    project: "Donors",
    due: "2d overdue",
    priorityColor: "#ef4444",
  },
  // Due Today
  {
    id: "t3", section: "today",
    name: "Migrate Student Records to New System",
    project: "Internal",
    due: "Today",
    priorityColor: "#f59e0b",
  },
  {
    id: "t4", section: "today",
    name: "Review Staff Allocations",
    project: "HR",
    due: "Today",
    priorityColor: "#f59e0b",
  },
  {
    id: "t5", section: "today",
    name: "Finalize Budget Allocation for Q1 2025",
    project: "Finance",
    due: "Today",
    priorityColor: "#00a8e8",
  },
  // Upcoming
  {
    id: "t6", section: "upcoming",
    name: "Design Teacher Training Workshop",
    project: "Education",
    due: "Oct 22",
    priorityColor: "#00a8e8",
  },
  {
    id: "t7", section: "upcoming",
    name: "Update Emergency Contact List",
    project: "Safety",
    due: "Oct 20",
    priorityColor: "#cbd5e1",
  },
  {
    id: "t8", section: "upcoming",
    name: "Onboard 3 New Field Coordinators",
    project: "HR",
    due: "Nov 1",
    priorityColor: "#cbd5e1",
  },
  {
    id: "t9", section: "upcoming",
    name: "File Annual Compliance Report",
    project: "Legal",
    due: "Oct 28",
    priorityColor: "#cbd5e1",
  },
  {
    id: "t10", section: "upcoming",
    name: "Monthly Donor Newsletter — November",
    project: "Comms",
    due: "Nov 5",
    priorityColor: "#cbd5e1",
  },
];
 
const STATS = [
  { value: 2,  label: "Overdue",   color: "text-red-500"    },
  { value: 3,  label: "Due Today", color: "text-amber-500"  },
  { value: 8,  label: "This Week", color: "text-sky-500"    },
  { value: 12, label: "Completed", color: "text-emerald-500"},
];
 
const STREAK_DAYS = [true, true, true, false, true, true, true]; // true = completed
 
const CALENDAR_TASK_DAYS = new Set([3, 5, 10, 19]); // days with tasks (demo)
 
const VIEW_TABS_DATA = [
  { id: "board",    href: "#board",    icon: "fa-table-columns", label: "Board" },
  { id: "list",     href: "#list",     icon: "fa-list",           label: "List" },
  { id: "calendar", href: "#calendar", icon: "fa-calendar",       label: "Calendar" },
  { id: "gantt",    href: "#gantt",    icon: "fa-bars-staggered", label: "Gantt" },
  { id: "table",    href: "#table",    icon: "fa-table-cells",    label: "Table" },
];
 
 
let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"My Work",
    color:"text-slate-800",
    ref:""
  },
  
]
export default function MyWorkPage({ userName = "Basmala" , setPath}) {

    useEffect(()=>{
        setPath(path);
    }, []);
  const [completedIds, setCompletedIds] = useState(new Set());
 
  const handleComplete = useCallback((id) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
 
  // Group tasks by section
  const tasksBySection = useMemo(() => ({
    overdue:  INITIAL_TASKS.filter((t) => t.section === "overdue"),
    today:    INITIAL_TASKS.filter((t) => t.section === "today"),
    upcoming: INITIAL_TASKS.filter((t) => t.section === "upcoming"),
  }), []);
 
  // Critical task = first non-completed overdue item
  const criticalTask = INITIAL_TASKS.find(
    (t) => t.section === "overdue" && !completedIds.has(t.id)
  ) ?? INITIAL_TASKS[0];
 
  return (
    <>
    <ViewTabs />
      
        
          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="My Work">
            <div className="max-w-[1200px] mx-auto">
 
              {/* Page heading */}
              <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
                <i className="fa-solid fa-circle-check text-indigo-500" aria-hidden="true" />
                My Work
              </h1>
              <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-5">
                Good morning, {userName} — you have 3 tasks due today and 2 overdue.
              </p>
 
              {/* Focus banner */}
              <FocusBanner
                criticalTask={criticalTask}
                onFocusStart={() => console.info("Focus mode started for:", criticalTask.id)}
              />
 
              {/* Stats */}
              <section
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
                aria-label="Task summary statistics"
              >
                {STATS.map((s) => (
                  <StatCard key={s.label} value={s.value} label={s.label} color={s.color} />
                ))}
              </section>
 
              {/* Two-column layout */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
 
                {/* Main task lists */}
                <div>
                  {(["overdue", "today", "upcoming"]).map((sectionKey) => (
                    <TaskSection
                      key={sectionKey}
                      sectionKey={sectionKey}
                      tasks={tasksBySection[sectionKey]}
                      completedIds={completedIds}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
 
                {/* Sidebar widgets */}
                <aside aria-label="Work sidebar">
                  <MiniCalendar taskDays={CALENDAR_TASK_DAYS} />
                  <CompletionStreak streak={7} bestStreak={14} days={STREAK_DAYS} />
                </aside>
 
              </div>
            </div>
          </main>
        
          
    </>
  );
}
 