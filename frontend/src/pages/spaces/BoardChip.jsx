import React from 'react'

const BoardChip = ({ board }) => {
  if (board.archived) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 line-through opacity-60 cursor-default select-none">
        <i className={`fa-solid ${board.icon} text-[11px]`} aria-hidden="true" />
        {board.label}
        <span className="sr-only">(archived)</span>
      </span>
    );
  }
  return (
    <a
      href={`#board-${board.id}`}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-all duration-150"
    >
      <i className={`fa-solid ${board.icon} text-[11px] text-slate-400`} aria-hidden="true" />
      {board.label}
    </a>
  );
}

export default BoardChip
