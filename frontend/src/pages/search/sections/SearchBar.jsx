import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const SearchBar = ({ value, onChange, onSubmit, inputRef, placeholder }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  const handleKey = (event) => {
    if (event.key === "Enter") {
      onSubmit(value);
    }
  };

  return (
    <div className="relative mx-auto max-w-[600px]">
      <i
        className={`fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 text-[15px] text-slate-400 pointer-events-none ${isRTL ? "right-4" : "left-4"}`}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? t("searchPage.inputPlaceholder")}
        className={`w-full rounded-xl border-2 border-slate-200 bg-white py-3.5 text-[14px] text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${isRTL ? "pr-11 pl-28 text-right" : "pl-11 pr-28 text-left"}`}
        aria-label={t("searchPage.inputPlaceholder")}
        autoFocus
      />
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-500 pointer-events-none dark:bg-indigo-900/40 ${isRTL ? "left-3.5" : "right-3.5"}`}
      >
        <span className="flex items-center gap-1">
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
          {t("searchPage.aiSearch")}
        </span>
      </span>
    </div>
  );
};

export default SearchBar;
