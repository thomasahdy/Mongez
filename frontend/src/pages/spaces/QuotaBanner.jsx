import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const QuotaBanner = ({ used, total, onUpgrade }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const pct = Math.round((used / total) * 100);
  const remaining = total - used;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-sky-200 bg-gradient-to-r from-indigo-50/60 to-sky-50/60 px-5 py-3.5 dark:border-sky-800/50 dark:from-indigo-900/20 dark:to-sky-900/20"
      role="status"
      aria-label={t("spacesPage.quotaAria", { used, total })}
    >
      <i className="fa-solid fa-layer-group shrink-0 text-[20px] text-sky-500" aria-hidden="true" />

      <p className="min-w-0 flex-1 text-[13px] text-slate-600 dark:text-slate-300">
        {t("spacesPage.quotaUsing")}{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {t("spacesPage.quotaFreeSpaces", { used, total })}
        </strong>
        . {t("spacesPage.quotaUpgrade")}
      </p>

      <div className="w-28 shrink-0" aria-hidden="true">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`mt-1 text-[10px] text-slate-400 ${isRTL ? "text-left" : "text-right"}`}>{t("spacesPage.quotaRemaining", { count: remaining })}</p>
      </div>

      <Button variant="outline" size="md" onClick={onUpgrade}>
        {t("spacesPage.upgrade")}
      </Button>
    </div>
  );
};

export default QuotaBanner;
