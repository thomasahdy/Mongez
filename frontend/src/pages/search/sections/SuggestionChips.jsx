import React from 'react'

const SuggestionChips = ({ chips, onSelect }) => {
  return (
      <div
        className="flex flex-wrap justify-center gap-2 mt-4"
        role="group"
        aria-label="Search suggestions"
      >
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onSelect(chip)}
            className="text-[12px] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {chip}
          </button>
        ))}
      </div>
    );
}

export default SuggestionChips
