import React from "react";
import { useTranslation } from "react-i18next";
import PriorityBar from "../../components/reports/PriorityBar";
import ChartCard from "../../components/reports/ChartCard";
import { usePriorityBreakdown } from "../../hooks/api/useAnalytics";

const PRIORITY_CONFIG = {
  URGENT: { color: "#ef4444" },
  HIGH: { color: "#f97316" },
  MEDIUM: { color: "#3b82f6" },
  LOW: { color: "#10b981" },
};

const normalizePriority = (data = []) => {
  const total = data.reduce((sum, i) => sum + i.count, 0);

  return data.map((item) => ({
    label: item.label,
    count: item.count,
    pct: total ? Math.round((item.count / total) * 100) : 0,
    color: PRIORITY_CONFIG[item.label]?.color || "#6366f1",
  }));
};

const PriorityBreakdown = ({ spaceId, period }) => {
  const { t } = useTranslation();
  const {data, isLoading, error} = usePriorityBreakdown(spaceId, period);
  const priorities = normalizePriority(Array.isArray(data) ? data : []);

  if (isLoading) {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
      ))}
    </div>
  );
} 
if (error) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="text-red-500 text-2xl mb-2">
        <i className="fa-solid fa-circle-exclamation" />
      </div>

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("reportsPage.priorityFailedTitle")}
      </p>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {t("reportsPage.priorityFailedDescription")}
      </p>
    </div>
  );
}
if (!data || data.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="text-slate-400 text-3xl mb-2">
        <i className="fa-regular fa-chart-bar" />
      </div>

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("reportsPage.priorityEmptyTitle")}
      </p>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {t("reportsPage.priorityEmptyDescription")}
      </p>
    </div>
  );
}
  return (
    <ChartCard title={t("reportsPage.priorityTitle")}>
      <div className="flex flex-col gap-5">
        {priorities.map((p) => (
          <PriorityBar key={p.label} item={p} />
        ))}
      </div>
    </ChartCard>
  );
}

export default PriorityBreakdown
