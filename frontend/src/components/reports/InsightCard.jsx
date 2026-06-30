import { useTranslation } from "react-i18next";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const InsightCard = ({ insight }) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const title =
    insight?.id && t(`reportsPage.insights.${insight.id}.title`, { defaultValue: insight.title });
  const description =
    insight?.id &&
    t(`reportsPage.insights.${insight.id}.description`, {
      defaultValue: insight.description,
    });

  return (
    <div className={`flex gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
      <div className={`text-[20px] pt-0.5 shrink-0 ${insight.iconColor}`}>
        <i className={`fa-solid ${insight.icon}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">{title || insight.title}</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">{description || insight.description}</p>
      </div>
    </div>
  );
}

export default InsightCard
