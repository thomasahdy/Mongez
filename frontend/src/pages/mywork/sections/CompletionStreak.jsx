import React from "react";
import { useTranslation } from "react-i18next";

const CompletionStreak = ({ streak, bestStreak, days, historyAvailable = true, totalCompleted = 0 }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
        <i className="fa-solid fa-fire text-amber-500" aria-hidden="true" />
        {t("myWorkPage.completionStreak")}
      </h4>

      {!historyAvailable ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300">
            <i className="fa-solid fa-circle-check text-[10px]" aria-hidden="true" />
            {t("myWorkPage.completedSoFar", { count: totalCompleted })}
          </div>
          <p className="text-[12px] leading-6 text-slate-500 dark:text-slate-400">
            {t("myWorkPage.completionHistoryPending")}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
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
                className={`h-3 w-3 rounded-[3px] ${done ? "bg-emerald-500" : "bg-amber-400"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CompletionStreak;
