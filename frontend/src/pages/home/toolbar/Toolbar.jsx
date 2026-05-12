import React from 'react'
import ToolbarBtn from './ToolbarBtn';

const Toolbar = () => {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-1.5 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-0.5">
        <ToolbarBtn icon="fa-layer-group" title="Group" />
        <ToolbarBtn icon="fa-sitemap" title="Subtasks" />
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" role="separator" />
        <ToolbarBtn icon="fa-arrow-up-wide-short" title="Sort" />
        <ToolbarBtn icon="fa-filter" title="Filter" />
        <ToolbarBtn icon="fa-circle-check" title="Show Closed" />
        <ToolbarBtn icon="fa-user" title="Members" />
        <ToolbarBtn title="Me Mode">
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-[9px] font-semibold text-white">T</span>
        </ToolbarBtn>
      </div>
      <div className="flex items-center gap-0.5">
        <ToolbarBtn icon="fa-magnifying-glass" title="Search" />
        <ToolbarBtn icon="fa-gear" title="Settings" />
        <button
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-sky-500 hover:bg-sky-600 hover:shadow-[0_2px_8px_rgba(0,168,232,0.3)] hover:-translate-y-px transition-all duration-150"
          aria-label="Create new task"
        >
          <i className="fa-solid fa-plus" />
          Task
          <i className="fa-solid fa-chevron-down text-[9px] opacity-70" />
        </button>
      </div>
    </div>
  );
}

export default Toolbar
