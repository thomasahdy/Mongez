import React from 'react'

const NoResults = ({ query }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
        <i className="fa-solid fa-magnifying-glass text-slate-400 text-[24px]" aria-hidden="true" />
      </div>
      <p className="text-[16px] font-semibold text-slate-600 dark:text-slate-300 mb-1">No results for "{query}"</p>
      <p className="text-[13px] text-slate-400 dark:text-slate-500 max-w-xs">
        Try different keywords or ask AI a question in plain language.
      </p>
    </div>
  );
}

export default NoResults
