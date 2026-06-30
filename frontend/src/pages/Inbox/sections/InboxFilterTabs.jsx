import { useTranslation } from "react-i18next";

const InboxFilterTabs = ({ tabs, activeId, onChange }) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex gap-0.5 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-1 mb-4 w-fit overflow-x-auto"
      role="tablist"
      aria-label={t("inboxPage.filtersAria")}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold rounded-md whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
            ${activeId === tab.id
              ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none font-bold">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default InboxFilterTabs
