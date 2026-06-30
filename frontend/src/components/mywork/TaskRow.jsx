import useLocaleDirection from "../../hooks/useLocaleDirection";

const TaskRow = ({ task, leftBorder, dueColor, completed, onComplete }) => {
  const { dir, isRtl } = useLocaleDirection();
  const borderClass = leftBorder
    ? `${isRtl ? "border-r-4" : "border-l-4"} ${leftBorder}`
    : "";

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
        bg-white dark:bg-slate-800
        hover:bg-gradient-to-r hover:from-slate-50 hover:to-white
        dark:hover:from-slate-700/40 dark:hover:to-slate-800
        border border-transparent hover:border-slate-200 dark:hover:border-slate-600
        shadow-sm hover:shadow
        ${completed ? "opacity-50" : ""}
        ${borderClass}
      `}
      role="listitem"
      aria-label={task.name}
      onClick={() => !completed && onComplete(task.id)}
      dir={dir}
    >
      <label
        className="relative flex items-center justify-center w-5 h-5 cursor-pointer shrink-0"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={completed}
          onChange={() => onComplete(task.id)}
          className="peer sr-only"
        />

        <div
          className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600
          bg-white dark:bg-slate-800
          transition-all duration-200
          peer-hover:border-emerald-400
          peer-checked:bg-emerald-500
          peer-checked:border-emerald-500
          peer-checked:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
        />

        <i
          className="absolute text-[10px] text-white opacity-0 scale-50 transition-all duration-200
          peer-checked:opacity-100 peer-checked:scale-100 fa-solid fa-check"
        />
      </label>

      <span
        className={`flex-1 text-[13px] truncate transition-colors ${
          completed
            ? "line-through text-slate-400"
            : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"
        }`}
      >
        {task.name}
      </span>

      <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
        {task.project}
      </span>

      <span
        className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
          dueColor.includes("red")
            ? "bg-red-50 text-red-500 dark:bg-red-900/20"
            : dueColor.includes("amber")
              ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20"
              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
        }`}
      >
        {task.due}
      </span>
    </div>
  );
};

export default TaskRow;
