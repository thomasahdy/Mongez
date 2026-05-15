import React from 'react'
import TaskCard from './TaskCard';

const BoardColumn = ({ column }) => {
  const { id, label, icon, iconColor, metrics, metricsExtra, count, countVariant = "neutral", cards, done } = column;

  const countStyles = {
    neutral: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
    waiting: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
    primary: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
    accent:  "bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300",
  };

  return (
    <section
      className="w-[300px] min-w-[300px] flex flex-col gap-2 shrink-0"
      aria-label={`Column: ${label}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-0.5 mb-2">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-[13px]" style={iconColor ? { color: iconColor } : {}}>
            <i className={icon} />
            {label}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {metrics}
            {metricsExtra && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-orange-500 font-semibold">
                <i className="fa-solid fa-triangle-exclamation" /> {metricsExtra}
              </span>
            )}
          </div>
        </div>
        {count !== undefined && (
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${countStyles[countVariant]}`}>
            {count}
          </span>
        )}
      </div>

      {/* Cards */}
      <div role="list" className="flex flex-col gap-2">
        {cards.map((card, i) => (
          <TaskCard key={i} card={card} />
        ))}
      </div>

      {/* Archive link for done column */}
      {done && (
        <div className="text-center mt-1">
          <a href="#" className="text-[12px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition-colors">
            <i className="fa-solid fa-box-archive" /> View 11 archived items
          </a>
        </div>
      )}

      {/* Add task */}
      <button
        className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-all duration-150"
        aria-label={`Add task to ${label}`}
      >
        <i className="fa-solid fa-plus" /> Add Task
      </button>
    </section>
  );
}

export default BoardColumn
