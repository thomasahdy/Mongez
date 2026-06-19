import React from 'react'

const SourcePill = ({ icon, label }) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-full">
      <i className={`fa-solid ${icon} text-[10px] text-indigo-400`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default SourcePill
