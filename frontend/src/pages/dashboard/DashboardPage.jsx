import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { useDashboardAnalyticsQuery } from "../../hooks/useDashboardQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]; // Replaced CSS variables with clean baseline theme hexes

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function normalizeStats(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (Array.isArray(payload)) return Object.assign({}, ...payload);
  if (Array.isArray(payload?.data)) return Object.assign({}, ...payload.data);
  return payload.data || payload;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.members)) return payload.members;
  if (Array.isArray(payload?.breakdown)) return payload.breakdown;
  return [];
}

function pickNumber(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], source);
    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value, fallback);
    }
  }
  return fallback;
}

function formatNumber(value, locale = "en-US") {
  if (value === null || value === undefined) {
    return "--";
  }
  return new Intl.NumberFormat(locale, { notation: Math.abs(value) >= 10000 ? "compact" : "standard" }).format(value);
}

function formatPercent(value, locale = "en-US") {
  if (value === null || value === undefined) {
    return "--";
  }
  return `${new Intl.NumberFormat(locale).format(Math.round(toNumber(value)))}%`;
}

function formatCurrency(value, locale = "en-US") {
  if (value === null || value === undefined) {
    return "--";
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(value);
}

function itemLabel(item, fallback) {
  return item.label || item.status || item.priority || item.name || item.title || fallback;
}

function itemValue(item) {
  return toNumber(item.value ?? item.count ?? item.tasks ?? item.total ?? item.percentage);
}

function formatDate(value, locale = "en-US") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function Sparkline({ color = "#3b82f6", direction = "up" }) {
  const points =
    direction === "down"
      ? "0,4 15,6 30,8 45,10 60,14 75,16 90,18 100,20"
      : "0,20 15,16 30,18 45,12 60,14 75,8 90,6 100,4";

  return (
    <svg className="w-full mt-3" width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" points={points} />
    </svg>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, suffix = "", trend, trendDirection = "up", loading, liveLabel = "Live", isRTL = false }) {
  const isDown = trendDirection === "down";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
      <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          <i className={`fa-solid ${icon} text-lg`} />
        </div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDown ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30" : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"}`}>
          {trend ? (
            <span className="flex items-center gap-1">
              <i className={`fa-solid ${isDown ? "fa-arrow-down" : "fa-arrow-up"}`} />
              {trend}
            </span>
          ) : (
            liveLabel
          )}
        </div>
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100" aria-busy={loading}>
        {loading ? (
          <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        ) : (
          `${value}${suffix}`
        )}
      </div>
      <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">{label}</div>
      <Sparkline color={iconColor.includes("emerald") ? "#10b981" : iconColor.includes("amber") ? "#f59e0b" : iconColor.includes("purple") ? "#a855f7" : "#3b82f6"} direction={trendDirection} />
    </div>
  );
}

function InsightCard({ type, icon, color, text, action, isRTL = false }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
      <div>
        <div className={`flex items-center gap-2 text-sm font-semibold mb-2 ${isRTL ? "flex-row-reverse" : ""}`} style={{ color }}>
          <i className={`fa-solid ${icon}`} />
          {type}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed">{text}</div>
      </div>
      <button type="button" className={`mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ${isRTL ? "flex-row-reverse" : ""}`}>
        <i className={`fa-solid ${isRTL ? "fa-arrow-left" : "fa-arrow-right"}`} />
        {action}
      </button>
    </div>
  );
}

function BarChart({ items, emptyLabel }) {
  if (!items.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">{emptyLabel}</div>;
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="flex h-48 items-end gap-3 pt-4">
      {items.slice(0, 7).map((item) => (
        <div className="flex flex-1 flex-col items-center gap-2 h-full justify-end" key={item.label}>
          <div className="w-full flex-1 bg-slate-50 rounded-md flex items-end dark:bg-slate-900" title={`${item.label}: ${item.value}`}>
            <div 
              className="w-full bg-blue-500 rounded-md transition-all duration-500 hover:bg-blue-600" 
              style={{ height: `${Math.max(4, (item.value / maxValue) * 100)}%` }} 
            />
          </div>
          <div className="w-full text-center text-[11px] font-medium text-slate-400 truncate dark:text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function DistributionChart({ items, emptyLabel, locale }) {
  if (!items.length) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">{emptyLabel}</div>;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const angles = items.slice(0, 4).reduce((accumulator, item) => {
    const previousAngle = accumulator.length ? Number.parseInt(accumulator[accumulator.length - 1], 10) : 0;
    const nextAngle = previousAngle + (item.value / total) * 360;
    return [...accumulator, `${Math.round(nextAngle)}deg`];
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
      <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700"
        style={{
          background: `conic-gradient(
            ${CHART_COLORS[0]} 0deg ${angles[0] || "0deg"}, 
            ${CHART_COLORS[1]} ${angles[0] || "0deg"} ${angles[1] || "0deg"}, 
            ${CHART_COLORS[2]} ${angles[1] || "0deg"} ${angles[2] || "0deg"}, 
            ${CHART_COLORS[3]} ${angles[2] || "0deg"} 360deg
          )`
        }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-100 shadow-inner">
          {formatNumber(total, locale)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 w-full">
        {items.slice(0, 4).map((item, index) => (
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-sm dark:border-slate-700/50" key={item.label}>
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-200">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[index] }} />
              <span className="truncate max-w-[140px]">{item.label}</span>
            </span>
            <strong className="text-slate-900 dark:text-slate-100">{formatNumber(item.value, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { setPath } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const spaceId = activeSpace?.id || spaces[0]?.id;
  const [actionError, setActionError] = useState("");
  const [exporting, setExporting] = useState(false);
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const dashboardQuery = useDashboardAnalyticsQuery(spaceId);
  const loading = dashboardQuery.isLoading || dashboardQuery.isFetching;
  const stats = normalizeStats(dashboardQuery.data?.stats);
  const activity = normalizeList(dashboardQuery.data?.activity);
  const completion = normalizeList(dashboardQuery.data?.completion);
  const priority = normalizeList(dashboardQuery.data?.priority);
  const teamLoad = normalizeList(dashboardQuery.data?.teamLoad);
  const executiveMetrics = normalizeStats(dashboardQuery.data?.executiveMetrics);
  const slaMetrics = normalizeStats(dashboardQuery.data?.slaMetrics);
  const workflowAnalytics = normalizeStats(dashboardQuery.data?.workflowAnalytics);
  const approverPerformance = normalizeList(dashboardQuery.data?.approverPerformance);
  const upcomingDeadlines = normalizeList(dashboardQuery.data?.upcomingDeadlines);

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || t("common.workspace"), color: "text-slate-400 dark:text-slate-500", ref: "/dashboard" },
      { name: t("dashboard.title"), color: "text-slate-800 dark:text-slate-200", ref: "" },
    ]);
  }, [activeSpace?.name, setPath, t]);

  const queryError = !spaceId
    ? t("dashboard.selectWorkspace")
    : dashboardQuery.isError
      ? dashboardQuery.error?.message || t("dashboard.loadFailed")
      : "";
  const error = actionError || queryError;

  const exportDashboard = async () => {
    if (!spaceId) {
      setActionError(t("dashboard.exportSelectWorkspace"));
      return;
    }

    setExporting(true);
    setActionError("");

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        space: { id: spaceId, name: activeSpace?.name || null },
        stats,
        activity,
        completion,
        priority,
        teamLoad,
        executiveMetrics,
        slaMetrics,
        workflowAnalytics,
        approverPerformance,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dashboard-${spaceId}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setActionError(exportError.message || t("dashboard.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const dashboardMetrics = useMemo(() => {
    const totalTasks = pickNumber(stats, ["activeTasks", "totalTasks", "tasks.total", "total"], null);
    const completedTasks = pickNumber(stats, ["completedTasks", "tasks.completed", "completed"], null);
    const overdueTasks = pickNumber(stats, ["overdueTasks", "tasks.overdue", "overdue"], null);
    const activeMembers = pickNumber(stats, ["activeMembers", "memberCount", "members.total", "members"], null);
    const deliveryRate = pickNumber(
      executiveMetrics,
      ["onTimeDeliveryRate", "deliveryRate"],
      pickNumber(slaMetrics, ["complianceRate", "slaCompliance"], totalTasks && completedTasks !== null ? (completedTasks / totalTasks) * 100 : null),
    );
    const budgetRemaining = pickNumber(
      executiveMetrics,
      ["budgetRemaining", "budget.remaining", "remainingBudget"],
      pickNumber(stats, ["budgetRemaining", "remainingBudget"], null),
    );

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      activeMembers,
      deliveryRate,
      budgetRemaining,
      pendingApprovals: pickNumber(executiveMetrics, ["pendingApprovals", "approvals.pending"], null),
      slaCompliance: pickNumber(
        executiveMetrics,
        ["slaCompliance", "compliance"],
        pickNumber(slaMetrics, ["complianceRate", "slaCompliance"], null),
      ),
    };
  }, [executiveMetrics, slaMetrics, stats]);

  const chartItems = useMemo(() => {
    const source = completion.length ? completion : priority;
    return source
      .map((item, index) => ({ label: itemLabel(item, `Item ${index + 1}`), value: itemValue(item) }))
      .filter((item) => item.value > 0);
  }, [completion, priority]);

  const distributionItems = useMemo(() => {
    const source = priority.length ? priority : completion;
    return source
      .map((item, index) => ({ label: itemLabel(item, `Segment ${index + 1}`), value: itemValue(item) }))
      .filter((item) => item.value > 0);
  }, [completion, priority]);

  const insights = useMemo(() => {
    const bottlenecks = pickNumber(workflowAnalytics, ["bottlenecks", "blockedItems", "blocked"], null);
    const avgApproval = pickNumber(executiveMetrics, ["avgApprovalTime", "averageApprovalTime"], null);
    return [
      {
        type: dashboardMetrics.overdueTasks > 0 ? t("dashboard.insights.riskAlert") : t("dashboard.insights.riskCheck"),
        icon: dashboardMetrics.overdueTasks > 0 ? "fa-triangle-exclamation" : "fa-shield-check",
        color: dashboardMetrics.overdueTasks > 0 ? "#ef4444" : "#10b981",
        text:
          dashboardMetrics.overdueTasks > 0
            ? t("dashboard.insights.riskText", { value: formatNumber(dashboardMetrics.overdueTasks, locale) })
            : dashboardMetrics.overdueTasks === null
              ? t("dashboard.insights.riskMissing")
              : t("dashboard.insights.riskNone"),
        action: t("dashboard.insights.reviewWorkload"),
      },
      {
        type: t("dashboard.insights.performance"),
        icon: "fa-chart-line",
        color: "#10b981",
        text: t("dashboard.insights.performanceText", { value: formatPercent(dashboardMetrics.deliveryRate, locale) }),
        action: t("dashboard.insights.openAnalytics"),
      },
      {
        type: t("dashboard.insights.workflow"),
        icon: "fa-route",
        color: "#3b82f6",
        text:
          bottlenecks > 0
            ? t("dashboard.insights.workflowBottlenecks", { value: formatNumber(bottlenecks, locale) })
            : avgApproval === null
              ? t("dashboard.insights.workflowFallbackNoAverage", {
                  pending: formatNumber(dashboardMetrics.pendingApprovals, locale),
                })
              : t("dashboard.insights.workflowFallback", {
                  pending: formatNumber(dashboardMetrics.pendingApprovals, locale),
                  average: `${formatNumber(avgApproval, locale)}h`,
                }),
        action: t("dashboard.insights.inspectFlow"),
      },
    ];
  }, [dashboardMetrics, executiveMetrics, workflowAnalytics, locale, t]);

  const hasAnalyticsData = Boolean(
    activity.length ||
      completion.length ||
      priority.length ||
      teamLoad.length ||
      Object.keys(stats || {}).length ||
      Object.keys(executiveMetrics || {}).length,
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-50 transition-colors dark:bg-slate-900" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
        
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-5 dark:border-slate-700">
          <h1 className="flex items-center gap-2.5 text-xl font-bold text-slate-900 dark:text-slate-100">
            <i className="fa-solid fa-chart-pie text-blue-500" />
            {t("dashboard.title")}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                setActionError("");
                dashboardQuery.refetch();
              }}
            >
              <i className="fa-solid fa-rotate" />
              {t("dashboard.refresh")}
            </button>
            <button 
              type="button" 
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" 
              onClick={exportDashboard} 
              disabled={loading || exporting}
            >
              <i className={`fa-solid ${exporting ? "fa-spinner fa-spin" : "fa-download"}`} />
              {exporting ? t("dashboard.exporting") : t("dashboard.export")}
            </button>
          </div>
        </div>

        {/* Error Notification banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Missing content state card */}
        {!error && !loading && !hasAnalyticsData ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
            {t("dashboard.noData")}
          </div>
        ) : null}

        {/* KPI Grid Section */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <KpiCard
            icon="fa-list-check"
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            iconColor="text-blue-500 dark:text-blue-400"
            label={t("dashboard.kpis.activeTasks")}
            value={formatNumber(dashboardMetrics.totalTasks, locale)}
            trend={dashboardMetrics.completedTasks ? t("dashboard.kpis.done", { value: formatNumber(dashboardMetrics.completedTasks, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
            isRTL={isRTL}
          />
          <KpiCard
            icon="fa-bullseye"
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconColor="text-emerald-500 dark:text-emerald-400"
            label={t("dashboard.kpis.onTimeDelivery")}
            value={loading ? "" : formatPercent(dashboardMetrics.deliveryRate, locale)}
            trend={dashboardMetrics.slaCompliance ? t("dashboard.kpis.sla", { value: formatPercent(dashboardMetrics.slaCompliance, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
            isRTL={isRTL}
          />
          <KpiCard
            icon="fa-coins"
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            iconColor="text-amber-500 dark:text-amber-400"
            label={t("dashboard.kpis.budgetRemaining")}
            value={loading ? "" : formatCurrency(dashboardMetrics.budgetRemaining, locale)}
            trendDirection="down"
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
            isRTL={isRTL}
          />
          <KpiCard
            icon="fa-users"
            iconBg="bg-purple-50 dark:bg-purple-950/40"
            iconColor="text-purple-500 dark:text-purple-400"
            label={t("dashboard.kpis.teamMembers")}
            value={formatNumber(dashboardMetrics.activeMembers, locale)}
            trend={teamLoad.length ? t("dashboard.kpis.active", { value: formatNumber(teamLoad.length, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
            isRTL={isRTL}
          />
        </div>

        {/* AI Smart Insights Section */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-md font-bold text-slate-800 dark:text-slate-200 mb-4">
            <i className="fa-solid fa-robot text-purple-500" />
            {t("dashboard.aiInsights")}
            <span className={`${isRTL ? "mr-1" : "ml-1"} text-[11px] font-medium text-slate-400 dark:text-slate-500`}>
              {t("dashboard.liveMetrics")}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {insights.map((insight) => (
              <InsightCard key={insight.type} {...insight} isRTL={isRTL} />
            ))}
          </div>
        </section>

        {/* Charts Container Grid Row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mb-8">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              <i className="fa-solid fa-chart-column text-blue-500" />
              {t("dashboard.charts.taskCompletion")}
            </h2>
            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                {t("dashboard.charts.loadingTaskAnalytics")}
              </div>
            ) : (
              <BarChart items={chartItems} emptyLabel={t("dashboard.charts.noCompletion")} />
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              <i className="fa-solid fa-chart-pie text-emerald-500" />
              {t("dashboard.charts.distribution")}
            </h2>
            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                {t("dashboard.charts.loadingDistribution")}
              </div>
            ) : (
              <DistributionChart items={distributionItems} emptyLabel={t("dashboard.charts.noDistribution")} locale={locale} />
            )}
          </section>
        </div>

        {/* Lists & Data Activity Bottom Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          
          {/* Recent Activity Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">
              <i className="fa-solid fa-clock-rotate-left text-slate-400 dark:text-slate-500" />
              {t("dashboard.recentActivity")}
            </h2>
            {activity.length ? (
              <div className="flex flex-col gap-4">
                {activity.slice(0, 6).map((item, index) => (
                  <div className="flex items-start gap-3 text-sm" key={item.id || index}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {(item.actor?.name || item.user?.name || item.userName || "A").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-600 dark:text-slate-200 leading-snug">
                        <strong className="text-slate-900 dark:text-slate-100 font-semibold">{item.actor?.name || item.user?.name || item.userName || t("dashboard.activityFallbackActor")}</strong>{" "}
                        {item.title || item.message || item.action || t("dashboard.activityFallbackAction")}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{item.createdAt ? new Date(item.createdAt).toLocaleString(locale) : item.time || t("dashboard.activityFallbackTime")}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("dashboard.noActivity")}</div>
            )}
          </section>

          {/* Upcoming Deadlines Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">
              <i className="fa-regular fa-calendar text-slate-400 dark:text-slate-500" />
              {t("dashboard.upcomingDeadlines")}
            </h2>
            {upcomingItems.length ? (
              <div className="flex flex-col gap-3">
                {upcomingItems.map((item) => (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-700/50 dark:bg-slate-900/20" key={item.id}>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">{formatDate(item.date, locale)}</div>
                    <div className="flex-1 min-w-0 text-slate-700 dark:text-slate-200 truncate">
                      <strong className="font-medium">{item.title}</strong>
                    </div>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">{t("dashboard.noDeadlines")}</div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

export default DashboardPage;