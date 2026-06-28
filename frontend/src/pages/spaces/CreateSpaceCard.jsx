import React from "react";
import { useTranslation } from "react-i18next";

const CreateSpaceCard = ({ remaining, onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-10 text-slate-400 transition-all duration-200 cursor-pointer hover:border-sky-400 hover:bg-sky-50/40 hover:text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-sky-900/10"
      aria-label={t("spacesPage.createNewSpaceAria")}
    >
      <i className="fa-solid fa-plus text-[32px]" aria-hidden="true" />
      <span className="text-[14px] font-semibold">{t("spacesPage.createSpaceTitle")}</span>
      <span className="text-[12px] font-normal">{t("spacesPage.createSpaceRemaining", { count: remaining })}</span>
    </button>
  );
};

export default CreateSpaceCard;
