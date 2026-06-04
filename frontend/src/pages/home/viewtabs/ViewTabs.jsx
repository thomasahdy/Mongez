import React from 'react'

const VIEW_TABS = [
  { href: "#board",    icon: "fa-table-columns", label: "Board",    id: "board" },
  { href: "#list",     icon: "fa-list",          label: "List",     id: "list" },
  { href: "#calendar", icon: "fa-regular fa-calendar", label: "Calendar", id: "calendar" },
  { href: "#gantt",    icon: "fa-bars-staggered", label: "Gantt",   id: "gantt" },
  { href: "#table",    icon: "fa-table-cells",   label: "Table",    id: "table" },
];

const ViewTabs = ({ activeTab = "board", onTabChange }) => {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 shrink-0">
      <div className="flex items-center gap-0 overflow-x-auto" role="tablist">
        {VIEW_TABS.map(({ id, href, icon, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 transition-all duration-150 whitespace-nowrap
              ${activeTab === id
                ? "text-sky-500 border-sky-500 font-semibold"
                : "text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300"
              }`}
          >
            <i className={`fa-solid ${icon}`} />
            {label}
          </button>
        ))}

        <button className="flex items-center gap-1 ml-2 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 border border-dashed border-slate-200 dark:border-slate-600 rounded-lg hover:text-sky-500 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-all duration-150 whitespace-nowrap">
          <i className="fa-solid fa-plus" /> View
        </button>
      </div>
    </div>
  );
}

export default ViewTabs
