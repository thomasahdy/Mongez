import React, { useRef } from 'react'
import SearchBar from './SearchBar';
import SuggestionChips from './SuggestionChips';

const SUGGESTION_CHIPS = [
  "Why is Funding blocked?",
  "Overdue tasks this week",
  "Ministry permit status",
  "Who is assigned to Curriculum?",
  "Tasks due tomorrow",
];


const SearchHero = ({ query, onQueryChange, onSearch }) => {
  const inputRef = useRef(null);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <h2 className="text-[22px] font-bold text-slate-800 dark:text-slate-100 mb-2">
        Search anything
      </h2>
      <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-5 text-center max-w-sm">
        Search tasks, files, people, and comments — or ask AI a question in plain language.
      </p>

      <div className="w-full max-w-[600px]">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          onSubmit={onSearch}
          inputRef={inputRef}
        />
        <SuggestionChips
          chips={SUGGESTION_CHIPS}
          onSelect={(chip) => { onQueryChange(chip); onSearch(chip); }}
        />
      </div>
    </div>
  );
}

export default SearchHero
