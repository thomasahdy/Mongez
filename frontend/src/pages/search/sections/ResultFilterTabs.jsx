import React from 'react'

const ResultFilterTabs = ({ tabs, activeId, onChange }) => {
  return (
    <div
      className="flex gap-0.5 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-1 mb-4 w-fit overflow-x-auto"
      role="tablist"
      aria-label="Filter search results"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold rounded-md whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
            ${activeId === tab.id
              ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
        >
          {tab.label}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeId === tab.id
                ? "bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300"
                : "bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-400"
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export default ResultFilterTabs
