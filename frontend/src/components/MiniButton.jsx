import React from 'react'

const MiniButton = ({ children, variant = "default", onClick }) => {
  const variants = {
    default:  "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600",
    primary:  "border-sky-200 bg-white text-sky-600 hover:bg-sky-50 dark:bg-slate-800 dark:border-sky-800",
    danger:   "border-red-200 bg-red-50/60 text-red-500 hover:bg-red-500 hover:text-white font-semibold dark:bg-red-900/20 dark:border-red-800",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border font-medium transition-all duration-150 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export default MiniButton
