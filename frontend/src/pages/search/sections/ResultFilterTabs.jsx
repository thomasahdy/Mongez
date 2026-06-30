import { useTranslation } from "react-i18next";

const ResultFilterTabs = ({ tabs, activeId, onChange }) => {
  const { t } = useTranslation();

  return (
    <div
      className="mb-4 flex w-fit gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-700/60"
      role="tablist"
      aria-label={t("searchPage.filterAria")}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            activeId === tab.id
              ? "bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          }`}
        >
          {tab.label}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              activeId === tab.id
                ? "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
                : "bg-slate-200 text-slate-400 dark:bg-slate-600 dark:text-slate-400"
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ResultFilterTabs;
