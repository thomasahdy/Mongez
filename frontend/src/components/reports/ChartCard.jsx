import React from 'react'

const ChartCard = ({ title, children, headerRight, className = "" }) => {
  return (
    <section
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm ${className}`}
      aria-label={title}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {headerRight && <div>{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}

export default ChartCard
