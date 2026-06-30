import { useTranslation } from "react-i18next";
import SourcePill from "./SourcePill";

const AIAnswerCard = ({ answer }) => {
  const { t } = useTranslation();

  return (
    <div
      className="mb-5 rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 p-5 dark:border-indigo-700/40 dark:from-indigo-900/25 dark:to-purple-900/15"
      role="region"
      aria-label={t("searchPage.aiAnswerAria")}
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
        <i className="fa-solid fa-robot" aria-hidden="true" />
        {t("searchPage.aiAnswerAria")}
      </div>

      <p className="mb-4 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
        {answer.text.map((segment, index) =>
          segment.bold ? (
            <strong key={index} className="font-semibold text-indigo-600 dark:text-indigo-300">
              {segment.value}
            </strong>
          ) : (
            <span key={index}>{segment.value}</span>
          ),
        )}
      </p>

      <div className="flex flex-wrap gap-2" aria-label={t("searchPage.sourcesAria")}>
        {answer.sources.map((source, index) => (
          <SourcePill key={index} icon={source.icon} label={source.label} />
        ))}
      </div>
    </div>
  );
};

export default AIAnswerCard;
