import { useTranslation } from "react-i18next";
import ChartCard from "../../components/reports/ChartCard";
import Button from "../../components/ui/Button";
import PerformerRow from "../../components/reports/PerformerRow";

const TopPerformersList = ({ performers }) => {
  const { t } = useTranslation();

  return (
    <ChartCard title={t("reportsPage.topPerformers")}>
      <div role="list" aria-label={t("reportsPage.topPerformersAria")}>
        {performers.map((p, i) => (
          <div key={p.id} role="listitem">
            <PerformerRow performer={p} rank={i} />
          </div>
        ))}
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
