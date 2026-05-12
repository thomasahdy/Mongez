import React, { useCallback, useEffect, useState } from 'react'

const AISidebar = ({ open, onClose }) => {
  const [inputVal, setInputVal] = useState("");
  
    const handleKey = useCallback((e) => {
      if (e.key === "Escape" && open) onClose();
    }, [open, onClose]);
  
    useEffect(() => {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }, [handleKey]);
  
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[999] transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
          aria-hidden="true"
        />
  
        {/* Panel */}
        <aside
          className={`fixed top-0 right-0 bottom-0 w-[360px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-[1000] flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
          aria-label="AI Assistant panel"
          aria-hidden={!open}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-robot text-indigo-500" />
              <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Mongez AI</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1" aria-label="Close AI panel">
              <i className="fa-solid fa-xmark text-[15px]" />
            </button>
          </div>
  
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {/* AI message */}
            <div className="self-start max-w-[88%] bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[13px] leading-relaxed px-3.5 py-2.5 rounded-xl rounded-bl-sm">
              Hello Thomas! I noticed <strong>Funding Release - Tranche 2</strong> has been blocked for <strong>23 days</strong>.
            </div>
  
            {/* Context card */}
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-chart-bar text-sky-500" /> Context
              </p>
              <ul className="space-y-1" aria-label="Context details">
                {[
                  <>Longer than <strong>89%</strong> of similar cases</>,
                  <>Affects <strong>3 downstream tasks</strong></>,
                  <>Last update: <strong>3 days ago</strong></>,
                ].map((item, i) => (
                  <li key={i} className="text-[13px] text-slate-500 dark:text-slate-300 flex items-center gap-2">
                    <span className="text-slate-300 text-lg leading-none">·</span>{item}
                  </li>
                ))}
              </ul>
            </div>
  
            {/* Suggested actions */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-bullseye text-indigo-500" /> Suggested Actions
              </p>
              {[
                { icon: "fa-regular fa-pen-to-square", label: "Draft escalation email" },
                { icon: "fa-regular fa-calendar-plus", label: "Schedule follow-up for Nov 1" },
                { icon: "fa-solid fa-user-tag",        label: "Reassign to backup contact" },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  className="flex items-center gap-2 w-full px-2.5 py-2 mb-1 last:mb-0 text-[13px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-400 hover:text-sky-600 hover:translate-x-0.5 transition-all duration-150"
                >
                  <i className={`${icon} w-4 text-center`} /> {label}
                </button>
              ))}
            </div>
          </div>
  
          {/* Footer / input */}
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-1.5 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 p-1">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Or type your own request..."
                className="flex-1 px-2.5 py-1.5 text-[13px] bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                aria-label="Ask AI"
              />
              <button
                className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white text-[12px] transition-colors"
                aria-label="Send message"
              >
                <i className="fa-solid fa-arrow-up" />
              </button>
            </div>
          </div>
        </aside>
      </>
    );
}

export default AISidebar
