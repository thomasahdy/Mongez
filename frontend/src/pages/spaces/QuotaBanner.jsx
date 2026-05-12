import React from 'react'
import Button from '../../components/Button';

const QuotaBanner = ({ used, total, onUpgrade }) => {
  const pct = Math.round((used / total) * 100);
  const remaining = total - used;
 
  return (
    <div
      className="flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-xl border border-sky-200 dark:border-sky-800/50 bg-gradient-to-r from-indigo-50/60 to-sky-50/60 dark:from-indigo-900/20 dark:to-sky-900/20 mb-6"
      role="status"
      aria-label={`Quota: ${used} of ${total} spaces used`}
    >
      <i className="fa-solid fa-layer-group text-sky-500 text-[20px] shrink-0" aria-hidden="true" />
 
      <p className="flex-1 text-[13px] text-slate-600 dark:text-slate-300 min-w-0">
        You are using{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {used} of {total} free spaces
        </strong>
        . Upgrade to Pro for unlimited spaces.
      </p>
 
      {/* Progress bar */}
      <div className="w-28 shrink-0" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 text-right">{remaining} remaining</p>
      </div>
 
      <Button variant="outline" size="md" onClick={onUpgrade}>
        Upgrade
      </Button>
    </div>
  );
}

export default QuotaBanner
