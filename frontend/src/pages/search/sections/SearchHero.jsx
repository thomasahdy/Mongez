import { useRef } from "react";
import { useTranslation } from "react-i18next";
import SearchBar from "./SearchBar";
import SuggestionChips from "./SuggestionChips";

const SUGGESTION_CHIPS = [
  "Why is Funding blocked?",
  "Overdue tasks this week",
  "Ministry permit status",
  "Who is assigned to Curriculum?",
  "Tasks due tomorrow",
];

const SearchHero = ({ query, onQueryChange, onSearch }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20">
      <h2 className="mb-2 text-[22px] font-bold text-slate-800 dark:text-slate-100">
        {t("searchPage.heroTitle")}
      </h2>
      <p className="mb-5 max-w-sm text-center text-[13px] text-slate-400 dark:text-slate-500">
        {t("searchPage.heroDescription")}
      </p>

      <div className="w-full max-w-[600px]">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          onSubmit={onSearch}
          inputRef={inputRef}
          placeholder={t("searchPage.inputPlaceholder")}
        />
        <SuggestionChips
          chips={SUGGESTION_CHIPS}
          onSelect={(chip) => {
            onQueryChange(chip);
            onSearch(chip);
          }}
        />
      </div>
    </div>
  );
};

export default SearchHero;
