import React from 'react'

const SearchBar = ({ value, onChange, onSubmit, inputRef, placeholder }) => {
  const handleKey = (e) => {
    if (e.key === "Enter") onSubmit(value);
  };

  return (
    <div className="relative max-w-[600px] mx-auto">
      <i
        className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[15px] pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? 'Search or ask AI…  e.g. "Why is Funding blocked?"'}
        className="w-full pl-11 pr-28 py-3.5 text-[14px] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)]"
        aria-label="Search or ask AI"
        autoFocus
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-1 rounded-full pointer-events-none">
        <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
        AI Search
      </span>
    </div>
  );
}

export default SearchBar
