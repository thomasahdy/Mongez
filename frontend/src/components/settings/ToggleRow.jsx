import React from 'react'

const ToggleRow = ({ id, title, description, checked, onChange, isLast = false }) => {
  return (
    <div className={`flex items-start justify-between gap-6 py-4 ${isLast ? "" : "border-b border-slate-200 dark:border-slate-700"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">{title}</p>
        <p className="text-[13px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-lg">{description}</p>
      </div>

      <label htmlFor={id} className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5" aria-label={title}>
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-200 dark:bg-slate-600 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 peer-focus-visible:ring-offset-2" />
        <div className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

export default ToggleRow
