import React from 'react';

export default function SpaceSwitcherSkeleton() {
  return (
    <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700">
      <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
      </div>
      <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
