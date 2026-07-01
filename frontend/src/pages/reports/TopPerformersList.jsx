import { useTranslation } from "react-i18next";
import ChartCard from "../../components/reports/ChartCard";
import Button from "../../components/ui/Button";
import PerformerRow from "../../components/reports/PerformerRow";

import { useTopPerformers } from "../../hooks/api/useAnalytics";

const TopPerformersList = ({ spaceId, period }) => {
  const { t } = useTranslation();
  const { data: performers = [] } = useTopPerformers(spaceId, period);

  return (
    <ChartCard title={t("reportsPage.topPerformers")}>
      <div role="list" aria-label={t("reportsPage.topPerformersAria")}>
        {performers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="text-slate-400 text-3xl mb-3">
              <i className="fa-solid fa-medal" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No top performers yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Performers will appear here once tasks are completed.
            </p>
          </div>
        ) : (
          performers.map((p, i) => (
            <div key={p.id} role="listitem">
              <PerformerRow performer={p} rank={i} />
            </div>
          ))
        )}
      </div>
      <Button
        variant="outline"
        size="md"
        className="w-full justify-center mt-4"
        aria-label={t("reportsPage.viewFullTeamList")}
      >
        {t("reportsPage.viewFullTeamList")}
      </Button>
    </ChartCard>
  )
}

export default TopPerformersList
