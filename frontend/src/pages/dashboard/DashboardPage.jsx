import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import { useDashboardAnalyticsQuery } from "../../hooks/useDashboardQueries";

const CHART_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--danger)"];

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

function Sparkline({ color = "var(--primary)", direction = "up" }) {
  const points =
    direction === "down"
      ? "0,4 15,6 30,8 45,10 60,14 75,16 90,18 100,20"
      : "0,20 15,16 30,18 45,12 60,14 75,8 90,6 100,4";

  return (
    <svg className="kpi-sparkline" width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" points={points} />
    </svg>
  );
}

function KpiCard({ icon, iconClass, label, value, suffix = "", trend, trendDirection = "up", loading, liveLabel = "Live" }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className={`kpi-icon ${iconClass}`}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <div className={`kpi-trend ${trendDirection}`}>
          {trend ? (
            <>
              <i className={`fa-solid ${trendDirection === "down" ? "fa-arrow-down" : "fa-arrow-up"}`} />
              {trend}
            </>
          ) : (
            liveLabel
          )}
        </div>
      </div>
      <div className="kpi-value" aria-busy={loading}>
        {loading ? (
          <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-slate-200" aria-hidden="true" />
        ) : (
          `${value}${suffix}`
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <Sparkline color={iconClass.includes("success") ? "var(--success)" : iconClass.includes("warning") ? "var(--warning)" : iconClass.includes("accent") ? "var(--accent)" : "var(--primary)"} direction={trendDirection} />
    </div>
  );
}

function InsightCard({ type, icon, color, text, action }) {
  return (
    <div className="insight-card">
      <div className="insight-type" style={{ color }}>
        <i className={`fa-solid ${icon}`} />
        {type}
      </div>
      <div className="insight-text">{text}</div>
      <div className="insight-action">
        <i className="fa-solid fa-arrow-right" />
        {action}
      </div>
    </div>
  );
}

function BarChart({ items, emptyLabel }) {
  if (!items.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="bar-chart">
      {items.slice(0, 7).map((item) => (
        <div className="bar-item" key={item.label}>
          <div className="bar-track" title={`${item.label}: ${item.value}`}>
            <div className="bar-fill" style={{ height: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
          </div>
          <div className="bar-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function DistributionChart({ items, emptyLabel, locale }) {
  if (!items.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let cumulative = 0;
  const angles = items.slice(0, 4).map((item) => {
    cumulative += (item.value / total) * 360;
    return `${Math.round(cumulative)}deg`;
  });

  return (
    <>
      <div className="donut-wrap">
        <div
          className="donut-chart"
          style={{
            "--donut-a": angles[0] || "0deg",
            "--donut-b": angles[1] || angles[0] || "0deg",
            "--donut-c": angles[2] || angles[1] || angles[0] || "0deg",
          }}
        >
          <div className="donut-inner">{formatNumber(total, locale)}</div>
        </div>
      </div>
      <div className="donut-legend">
        {items.slice(0, 4).map((item, index) => (
          <div className="legend-item" key={item.label}>
            <span className="legend-label">
              <span className="legend-dot" style={{ background: CHART_COLORS[index] }} />
              {item.label}
            </span>
            <strong>{formatNumber(item.value, locale)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardPage() {
  const { setPath } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const { t, i18n } = useTranslation();
  const spaceId = activeSpace?.id || spaces[0]?.id;
  const [error, setError] = useState("");
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

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: t("dashboard.title"), color: "text-slate-800", ref: "" },
    ]);
  }, [activeSpace?.name, setPath, t]);

  useEffect(() => {
    if (!spaceId) {
      setError(t("dashboard.selectWorkspace"));
      return;
    }

    if (dashboardQuery.isError) {
      setError(dashboardQuery.error?.message || t("dashboard.loadFailed"));
      return;
    }

    setError("");
  }, [dashboardQuery.error?.message, dashboardQuery.isError, spaceId, t]);

  const exportDashboard = async () => {
    if (!spaceId) {
      setError(t("dashboard.exportSelectWorkspace"));
      return;
    }

    setExporting(true);
    setError("");

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
      setError(exportError.message || t("dashboard.exportFailed"));
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
      ["onTimeDeliveryRate", "deliveryRate", "slaCompliance"],
      totalTasks && completedTasks !== null ? (completedTasks / totalTasks) * 100 : null,
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

  const upcomingItems = useMemo(() => {
    return activity
      .filter((item) => item.dueDate || item.deadline || item.endDate)
      .map((item, index) => ({
        id: item.id || index,
        date: item.dueDate || item.deadline || item.endDate,
        title: item.title || item.message || item.action || t("dashboard.upcomingItem"),
        status: item.status || item.priority || t("dashboard.dueLabel"),
      }))
      .slice(0, 5);
  }, [activity, t]);

  const insights = useMemo(() => {
    const bottlenecks = pickNumber(workflowAnalytics, ["bottlenecks", "blockedItems", "blocked"], null);
    const avgApproval = pickNumber(executiveMetrics, ["avgApprovalTime", "averageApprovalTime"], null);
    return [
      {
        type: dashboardMetrics.overdueTasks > 0 ? t("dashboard.insights.riskAlert") : t("dashboard.insights.riskCheck"),
        icon: dashboardMetrics.overdueTasks > 0 ? "fa-triangle-exclamation" : "fa-shield-check",
        color: dashboardMetrics.overdueTasks > 0 ? "var(--danger)" : "var(--success)",
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
        color: "var(--success)",
        text: t("dashboard.insights.performanceText", { value: formatPercent(dashboardMetrics.deliveryRate, locale) }),
        action: t("dashboard.insights.openAnalytics"),
      },
      {
        type: t("dashboard.insights.workflow"),
        icon: "fa-route",
        color: "var(--primary)",
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
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="dashboard-content">
        <div className="page-title">
          <i className="fa-solid fa-chart-pie" />
          {t("dashboard.title")}
          <div className="dashboard-page-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => {
                setError("");
                dashboardQuery.refetch();
              }}
            >
              <i className="fa-solid fa-rotate" />
              {t("dashboard.refresh")}
            </button>
            <button type="button" className="action-btn" onClick={exportDashboard} disabled={loading || exporting}>
              <i className={`fa-solid ${exporting ? "fa-spinner fa-spin" : "fa-download"}`} />
              {exporting ? t("dashboard.exporting") : t("dashboard.export")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        {!error && !loading && !hasAnalyticsData ? (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            {t("dashboard.noData")}
          </div>
        ) : null}

        <div className="kpi-grid">
          <KpiCard
            icon="fa-list-check"
            iconClass="bg-[var(--primary-light)] text-[var(--primary)]"
            label={t("dashboard.kpis.activeTasks")}
            value={formatNumber(dashboardMetrics.totalTasks, locale)}
            trend={dashboardMetrics.completedTasks ? t("dashboard.kpis.done", { value: formatNumber(dashboardMetrics.completedTasks, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
          />
          <KpiCard
            icon="fa-bullseye"
            iconClass="bg-[var(--success-light)] text-[var(--success)]"
            label={t("dashboard.kpis.onTimeDelivery")}
            value={loading ? "" : formatPercent(dashboardMetrics.deliveryRate, locale)}
            trend={dashboardMetrics.slaCompliance ? t("dashboard.kpis.sla", { value: formatPercent(dashboardMetrics.slaCompliance, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
          />
          <KpiCard
            icon="fa-coins"
            iconClass="bg-[var(--warning-light)] text-[var(--warning)]"
            label={t("dashboard.kpis.budgetRemaining")}
            value={loading ? "" : formatCurrency(dashboardMetrics.budgetRemaining, locale)}
            trendDirection="down"
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
          />
          <KpiCard
            icon="fa-users"
            iconClass="bg-[var(--accent-light)] text-[var(--accent)]"
            label={t("dashboard.kpis.teamMembers")}
            value={formatNumber(dashboardMetrics.activeMembers, locale)}
            trend={teamLoad.length ? t("dashboard.kpis.active", { value: formatNumber(teamLoad.length, locale) }) : ""}
            loading={loading}
            liveLabel={t("dashboard.liveBadge")}
          />
        </div>

        <section className="insights-section">
          <h3>
            <i className="fa-solid fa-robot" />
            {t("dashboard.aiInsights")}
            <span className="ml-1 text-[11px] font-medium text-[var(--text-tertiary)]">{t("dashboard.liveMetrics")}</span>
          </h3>
          <div className="insight-cards">
            {insights.map((insight) => (
              <InsightCard key={insight.type} {...insight} />
            ))}
          </div>
        </section>

        <div className="charts-row">
          <section className="chart-card">
            <h3 className="chart-title">
              <i className="fa-solid fa-chart-column" />
              {t("dashboard.charts.taskCompletion")}
            </h3>
            {loading ? <div className="empty-state">{t("dashboard.charts.loadingTaskAnalytics")}</div> : <BarChart items={chartItems} emptyLabel={t("dashboard.charts.noCompletion")} />}
          </section>

          <section className="chart-card">
            <h3 className="chart-title">
              <i className="fa-solid fa-chart-pie" />
              {t("dashboard.charts.distribution")}
            </h3>
            {loading ? <div className="empty-state">{t("dashboard.charts.loadingDistribution")}</div> : <DistributionChart items={distributionItems} emptyLabel={t("dashboard.charts.noDistribution")} locale={locale} />}
          </section>
        </div>

        <div className="bottom-grid">
          <section className="list-card">
            <h3 className="list-title">
              <i className="fa-solid fa-clock-rotate-left" />
              {t("dashboard.recentActivity")}
            </h3>
            {activity.length ? (
              activity.slice(0, 6).map((item, index) => (
                <div className="activity-item" key={item.id || index}>
                  <div className="activity-avatar">{(item.actor?.name || item.user?.name || item.userName || "A").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="activity-text">
                      <strong>{item.actor?.name || item.user?.name || item.userName || t("dashboard.activityFallbackActor")}</strong>{" "}
                      {item.title || item.message || item.action || t("dashboard.activityFallbackAction")}
                    </div>
                    <div className="activity-time">{item.createdAt ? new Date(item.createdAt).toLocaleString(locale) : item.time || t("dashboard.activityFallbackTime")}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">{t("dashboard.noActivity")}</div>
            )}
          </section>

          <section className="list-card">
            <h3 className="list-title">
              <i className="fa-regular fa-calendar" />
              {t("dashboard.upcomingDeadlines")}
            </h3>
            {upcomingItems.length ? (
              upcomingItems.map((item) => (
                <div className="upcoming-item" key={item.id}>
                  <div className="upcoming-date">{formatDate(item.date, locale)}</div>
                  <div className="upcoming-title">
                    <strong>{item.title}</strong>
                  </div>
                  <span className="upcoming-badge">{item.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">{t("dashboard.noDeadlines")}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
