import React from 'react'

const TaskRow = ({ task, leftBorder, dueColor, completed, onComplete }) => {
  return (
      <article
        className={`group flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all duration-150 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm ${leftBorder ? `border-l-[3px] ${leftBorder}` : ""} ${completed ? "opacity-50" : ""}`}
        role="listitem"
        aria-label={task.name}
        onClick={() => !completed && onComplete(task.id)}
      >
        {/* Completion checkbox */}
        <label
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-pointer"
          aria-label={`Mark "${task.name}" as complete`}
        >
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onComplete(task.id)}
            className="sr-only peer"
          />
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 hover:border-emerald-400 transition-all duration-150 flex items-center justify-center">
            {completed && <i className="fa-solid fa-check text-white text-[8px]" aria-hidden="true" />}
          </div>
        </label>
   
        {/* Priority dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: task.priorityColor }}
          aria-hidden="true"
        />
   
        {/* Task name */}
        <span className={`flex-1 text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate ${completed ? "line-through text-slate-400" : ""}`}>
          {task.name}
        </span>
   
        {/* Project pill */}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 hidden sm:inline">
          {task.project}
        </span>
   
        {/* Due date */}
        <span className={`text-[11px] font-semibold flex items-center gap-1 shrink-0 ${dueColor}`}>
          {dueColor.includes("red") || dueColor.includes("amber") ? (
            <i className="fa-regular fa-clock text-[10px]" aria-hidden="true" />
          ) : null}
          {task.due}
        </span>
      </article>
    );
}

export default TaskRow
