import React, { useState } from 'react'
import TaskRow from '../../../components/mywork/TaskRow';

const SECTION_CONFIG = {
  overdue:  { icon: "fa-fire",         label: "Overdue",   iconColor: "text-red-500",   countBg: "bg-red-100 dark:bg-red-900/30 text-red-500",   leftBorder: "border-l-red-500"   },
  today:    { icon: "fa-clock",        label: "Due Today", iconColor: "text-amber-500", countBg: "bg-amber-100 dark:bg-amber-900/30 text-amber-500", leftBorder: "border-l-amber-500" },
  upcoming: { icon: "fa-calendar-day", label: "Upcoming",  iconColor: "text-sky-500",   countBg: "bg-slate-100 dark:bg-slate-700 text-slate-500",  leftBorder: ""                   },
};
 
const TaskSection = ({ sectionKey, tasks, completedIds, onComplete }) => {
  const [open, setOpen] = useState(true);
    const cfg = SECTION_CONFIG[sectionKey];
    const activeTasks = tasks.filter((t) => !completedIds.has(t.id));
   
    // Due color per section
    const dueColors = {
      overdue:  "text-red-500",
      today:    "text-amber-500",
      upcoming: "text-slate-400 dark:text-slate-500",
    };
   
    return (
      <section className="mb-5" aria-label={cfg.label}>
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 py-2 mb-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
          aria-expanded={open}
        >
          <i className={`fa-solid ${cfg.icon} ${cfg.iconColor} text-[13px]`} aria-hidden="true" />
          <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{cfg.label}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.countBg}`}>
            {activeTasks.length}
          </span>
          <i
            className={`fa-solid fa-chevron-down text-[10px] text-slate-400 ml-auto transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </button>
   
        {/* Task list — animated collapse */}
        <div
          className={`flex flex-col gap-1.5 overflow-hidden transition-all duration-300 ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
          role="list"
          aria-label={`${cfg.label} tasks`}
        >
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              leftBorder={cfg.leftBorder}
              dueColor={dueColors[sectionKey]}
              completed={completedIds.has(task.id)}
              onComplete={onComplete}
            />
          ))}
          {activeTasks.length === 0 && tasks.length > 0 && (
            <p className="text-center text-[12px] text-slate-400 py-3">
              🎉 All done in this section!
            </p>
          )}
        </div>
      </section>
    );
}

export default TaskSection
