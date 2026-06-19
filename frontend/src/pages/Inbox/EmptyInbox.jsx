import React from 'react'

const EmptyInbox = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
        <i className="fa-solid fa-inbox text-slate-400 text-[28px]" aria-hidden="true" />
      </div>
      <p className="text-[16px] font-semibold text-slate-600 dark:text-slate-300 mb-1">All caught up!</p>
      <p className="text-[13px] text-slate-400 dark:text-slate-500 max-w-xs">
        No notifications here. Check back later or adjust your filters.
      </p>
    </div>
  );
}

export default EmptyInbox
