import React from "react";
import { useTranslation } from "react-i18next";

const CreateDepartmentCard = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center">
      <button
        onClick={onClick}
        className="mt-1 flex w-1/3 flex-col justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-7 text-slate-400 transition-all duration-200 cursor-pointer hover:border-sky-400 hover:bg-sky-50/40 hover:text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-sky-900/10"
        aria-label={t("spacesPage.createDepartment")}
      >
        <i className="fa-solid fa-plus text-[32px]" aria-hidden="true" />
        <span className="text-[14px] font-semibold">{t("spacesPage.createDepartment")}</span>
      </button>
    </div>
  );
};

export default CreateDepartmentCard;
