import React, { useState } from 'react'


const FAB_ITEMS = [
  { section: "Quick Create" },
  { icon: "fa-regular fa-square-check", label: "Task",      kbd: "T" },
  { icon: "fa-regular fa-calendar",     label: "Meeting",   kbd: "M" },
  { section: "Egyptian NGO Templates" },
  { icon: "fa-chart-pie",        label: "Donor Report (Q4)" },
  { icon: "fa-landmark",         label: "Ministry Submission" },
  { icon: "fa-money-bill-wave",  label: "Funding Request" },
  { icon: "fa-file-invoice",     label: "Procurement (3 quotes)" },
  { icon: "fa-user-pen",         label: "Staff Evaluation" },
  { section: "Recent" },
  { icon: "fa-clock-rotate-left", label: "Donor Report (Oct 15)", dim: true },
];

function FAB() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu */}
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
          role="menu"
        >
          {FAB_ITEMS.map((item, i) =>
            item.section ? (
              <div key={i} className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-700/50">
                {item.section}
              </div>
            ) : (
              <button
                key={i}
                role="menuitem"
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-none ${item.dim ? "opacity-60" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <i className={`fa-solid ${item.icon}`} />
                  {item.label}
                </span>
                {item.kbd && <kbd className="text-[10px] border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-400">{item.kbd}</kbd>}
              </button>
            )
          )}
        </div>
      )}

      {/* Pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200"
        aria-label="Create new item"
        aria-expanded={open}
      >
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-plus"} text-[14px] transition-transform duration-150`} />
        <span className="text-[13px] font-medium">Create</span>
        <span className="text-[10px] opacity-50 bg-white/15 px-1.5 py-0.5 rounded">Space</span>
      </button>
    </div>
  );
}

export default FAB
