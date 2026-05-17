import React from 'react'
import MiniButton from '../../components/ui/MiniButton';

const BlockerBox = ({ stuck, since, days, expected, confidence, cases, avgDays }) => {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 my-2 dark:bg-amber-900/20 dark:border-amber-800">
      <div className="flex gap-2 items-start mb-1">
        <i className="fa-solid fa-building-columns text-amber-600 text-[13px] mt-0.5 shrink-0" />
        <div className="text-[12px] text-amber-900 dark:text-amber-200 leading-snug">
          <strong>{stuck}</strong>
          <br />
          Since: {since} ({days} days)
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
        <i className="fa-solid fa-wand-magic-sparkles" />
        Expected resolution: {expected}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5 px-2 py-1 bg-indigo-50/60 dark:bg-indigo-900/20 rounded">
        <i className="fa-solid fa-chart-bar text-indigo-400" />
        {confidence}% confidence · Based on {cases} similar cases (avg {avgDays} days)
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <MiniButton variant="default">
          <i className="fa-regular fa-pen-to-square" /> Update Status
        </MiniButton>
        <MiniButton variant="primary">
          <i className="fa-solid fa-bell" /> Remind Omar
        </MiniButton>
        <MiniButton variant="danger">
          <i className="fa-solid fa-arrow-up" /> Escalate to Dept Head
        </MiniButton>
        <p className="w-full text-[10px] text-slate-400 italic flex items-center gap-1 mt-1">
          <i className="fa-solid fa-circle-info" />
          {days} days is longer than 89% of similar cases
        </p>
      </div>
    </div>
  );
}

export default BlockerBox
