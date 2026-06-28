import React from "react";
import { useTranslation } from "react-i18next";

const CompletionStreak = ({ streak, bestStreak, days }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
        <i className="fa-solid fa-fire text-amber-500" aria-hidden="true" />
        {t("myWorkPage.completionStreak")}
      </h4>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[26px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          {t("myWorkPage.streakDays", { count: streak })}
        </span>
        <span className="text-[12px] font-semibold text-emerald-500">
          {t("myWorkPage.bestStreak", { count: bestStreak })}
        </span>
      </div>

      <div className="flex gap-1.5" role="list" aria-label={t("myWorkPage.weeklyStreakAria")}>
        {days.map((done, index) => (
          <div
            key={index}
            role="listitem"
            aria-label={done ? t("myWorkPage.dayCompleted") : t("myWorkPage.dayMissed")}
            className={`w-3 h-3 rounded-[3px] ${done ? "bg-emerald-500" : "bg-amber-400"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default CompletionStreak;
