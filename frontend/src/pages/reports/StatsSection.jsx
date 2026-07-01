import { useTranslation } from "react-i18next";
import MetricCard from "../../components/reports/MetricCard";
import { useDashboardStats } from "../../hooks/api/useAnalytics";

const StatsSection = ({spaceId}) => {
  const { t } = useTranslation();
  const {data: metrics, isLoading, error} = useDashboardStats(spaceId);
  let rawMetrics = [];
  if (metrics) {
    if (metrics.healthScore) {
      rawMetrics.push({
        id: "health",
        title: "Workspace Health",
        value: `${metrics.healthScore.score}%`,
        icon: "fa-heart-pulse",
        iconColor: "text-emerald-500",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
        trend: {
          direction: metrics.healthScore.score >= 80 ? "up" : "down",
          label: `Grade: ${metrics.healthScore.grade}`
        }
      });
    }
    if (metrics.taskSummary) {
      const activeCount = Array.isArray(metrics.taskSummary) 
        ? metrics.taskSummary.reduce((sum, s) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BACKLOG'].includes(s.status) ? sum + s.count : sum, 0)
        : (metrics.taskSummary.todo + metrics.taskSummary.inProgress || 0);
        
      rawMetrics.push({
        id: "tasks",
        title: "Active Tasks",
        value: String(activeCount),
        icon: "fa-list-check",
        iconColor: "text-blue-500",
        iconBg: "bg-blue-100 dark:bg-blue-900/40",
      });
    }
    if (metrics.memberCount !== undefined) {
      rawMetrics.push({
        id: "members",
        title: "Team Members",
        value: String(metrics.memberCount),
        icon: "fa-users",
        iconColor: "text-purple-500",
        iconBg: "bg-purple-100 dark:bg-purple-900/40",
      });
    }
    if (metrics.pendingApprovals !== undefined) {
      rawMetrics.push({
        id: "approvals",
        title: "Pending Approvals",
        value: String(metrics.pendingApprovals),
        icon: "fa-clock",
        iconColor: "text-orange-500",
        iconBg: "bg-orange-100 dark:bg-orange-900/40",
      });
    }
  }

  const normalizedMetrics = rawMetrics;
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-medium">{t("reportsPage.loadingMetrics")}</p>
      </div>
    </div>
  );
}

if (error) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-5 py-4 rounded-xl text-sm font-medium shadow-sm">
        {t("reportsPage.failedMetrics")}
      </div>
    </div>
  );
}

if (normalizedMetrics.length === 0) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-8 rounded-xl shadow-sm">
        <div className="text-4xl mb-2">
            <i className="fa-solid fa-table"></i>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          {t("reportsPage.metricsEmptyTitle")}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("reportsPage.metricsEmptyDescription")}
        </p>
      </div>
    </div>
  );
}
    
  return (
    <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6"
        aria-label={t("reportsPage.metricsAria")}
        >
        {normalizedMetrics.map((m) => (
            <MetricCard key={m.id} metric={m}/>
        ))}
    </section>
  )
}

export default StatsSection
