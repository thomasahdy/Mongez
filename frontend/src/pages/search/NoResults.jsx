import React from "react";
import { useTranslation } from "react-i18next";

const NoResults = ({ query }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
        <i className="fa-solid fa-magnifying-glass text-[24px] text-slate-400" aria-hidden="true" />
      </div>
      <p className="mb-1 text-[16px] font-semibold text-slate-600 dark:text-slate-300">
        {t("searchPage.noResultsTitle", { query })}
      </p>
      <p className="max-w-xs text-[13px] text-slate-400 dark:text-slate-500">
        {t("searchPage.noResultsDescription")}
      </p>
    </div>
  );
};

export default NoResults;
