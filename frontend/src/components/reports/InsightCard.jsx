import React from 'react'

const InsightCard = ({ insight }) => {
  return (
    <div className="flex gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className={`text-[20px] pt-0.5 shrink-0 ${insight.iconColor}`}>
        <i className={`fa-solid ${insight.icon}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">{insight.title}</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">{insight.description}</p>
      </div>
    </div>
  );
}

export default InsightCard
