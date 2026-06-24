import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
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

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "--";
  }
  return new Intl.NumberFormat("en", { notation: Math.abs(value) >= 10000 ? "compact" : "standard" }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "--";
  }
  return `${Math.round(toNumber(value))}%`;
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "--";
  }
  return new Intl.NumberFormat("en", {
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

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
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

function KpiCard({ icon, iconClass, label, value, suffix = "", trend, trendDirection = "up", loading }) {
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
            "Live"
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

function BarChart({ items }) {
  if (!items.length) {
    return <div className="empty-state">No task completion data returned yet.</div>;
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

function DistributionChart({ items }) {
  if (!items.length) {
    return <div className="empty-state">No priority or status distribution returned yet.</div>;
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
          <div className="donut-inner">{formatNumber(total)}</div>
        </div>
      </div>
      <div className="donut-legend">
        {items.slice(0, 4).map((item, index) => (
          <div className="legend-item" key={item.label}>
            <span className="legend-label">
              <span className="legend-dot" style={{ background: CHART_COLORS[index] }} />
              {item.label}
            </span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardPage() {
  const { setPath } = useOutletContext() || {};
  const { activeSpace, spaces } = useAppContext();
  const spaceId = activeSpace?.id || spaces[0]?.id;
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
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
      { name: activeSpace?.name || "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: "Dashboard", color: "text-slate-800", ref: "" },
    ]);
  }, [activeSpace?.name, setPath]);

  useEffect(() => {
    if (!spaceId) {
      setError("Select a workspace to load dashboard analytics.");
      return;
    }

    if (dashboardQuery.isError) {
      setError(dashboardQuery.error?.message || "Unable to load dashboard data.");
      return;
    }

    setError("");
  }, [dashboardQuery.error?.message, dashboardQuery.isError, spaceId]);

  const exportDashboard = async () => {
    if (!spaceId) {
      setError("Select a workspace before exporting dashboard data.");
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
      setError(exportError.message || "Unable to export dashboard data.");
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
        title: item.title || item.message || item.action || "Upcoming item",
        status: item.status || item.priority || "Due",
      }))
      .slice(0, 5);
  }, [activity]);

  const insights = useMemo(() => {
    const bottlenecks = pickNumber(workflowAnalytics, ["bottlenecks", "blockedItems", "blocked"], null);
    const avgApproval = pickNumber(executiveMetrics, ["avgApprovalTime", "averageApprovalTime"], null);
    return [
      {
        type: dashboardMetrics.overdueTasks > 0 ? "Risk Alert" : "Risk Check",
        icon: dashboardMetrics.overdueTasks > 0 ? "fa-triangle-exclamation" : "fa-shield-check",
        color: dashboardMetrics.overdueTasks > 0 ? "var(--danger)" : "var(--success)",
        text:
          dashboardMetrics.overdueTasks > 0
            ? `${formatNumber(dashboardMetrics.overdueTasks)} overdue tasks are currently affecting the workspace.`
            : dashboardMetrics.overdueTasks === null
              ? "The backend did not return an overdue task count for this workspace yet."
              : "No overdue task count was returned for this workspace.",
        action: "Review workload",
      },
      {
        type: "Performance",
        icon: "fa-chart-line",
        color: "var(--success)",
        text: `Current on-time delivery is ${formatPercent(dashboardMetrics.deliveryRate)} based on available backend metrics.`,
        action: "Open analytics",
      },
      {
        type: "Workflow",
        icon: "fa-route",
        color: "var(--primary)",
        text:
          bottlenecks > 0
            ? `${formatNumber(bottlenecks)} workflow bottlenecks are reported by the analytics API.`
            : `Pending approvals: ${formatNumber(dashboardMetrics.pendingApprovals)}. Average approval time: ${formatNumber(avgApproval)}${avgApproval === null ? "" : "h"}.`,
        action: "Inspect flow",
      },
    ];
  }, [dashboardMetrics, executiveMetrics, workflowAnalytics]);
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
          Executive Dashboard
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
              Refresh
            </button>
            <button type="button" className="action-btn" onClick={exportDashboard} disabled={loading || exporting}>
              <i className={`fa-solid ${exporting ? "fa-spinner fa-spin" : "fa-download"}`} />
              {exporting ? "Exporting" : "Export"}
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
            Analytics endpoints are reachable, but no dashboard metrics were returned for this workspace yet.
          </div>
        ) : null}

        <div className="kpi-grid">
          <KpiCard
            icon="fa-list-check"
            iconClass="bg-[var(--primary-light)] text-[var(--primary)]"
            label="Active Tasks"
            value={formatNumber(dashboardMetrics.totalTasks)}
            trend={dashboardMetrics.completedTasks ? `${formatNumber(dashboardMetrics.completedTasks)} done` : ""}
            loading={loading}
          />
          <KpiCard
            icon="fa-bullseye"
            iconClass="bg-[var(--success-light)] text-[var(--success)]"
            label="On-Time Delivery Rate"
            value={loading ? "" : formatPercent(dashboardMetrics.deliveryRate)}
            trend={dashboardMetrics.slaCompliance ? `${formatPercent(dashboardMetrics.slaCompliance)} SLA` : ""}
            loading={loading}
          />
          <KpiCard
            icon="fa-coins"
            iconClass="bg-[var(--warning-light)] text-[var(--warning)]"
            label="Budget Remaining"
            value={loading ? "" : formatCurrency(dashboardMetrics.budgetRemaining)}
            trendDirection="down"
            loading={loading}
          />
          <KpiCard
            icon="fa-users"
            iconClass="bg-[var(--accent-light)] text-[var(--accent)]"
            label="Team Members"
            value={formatNumber(dashboardMetrics.activeMembers)}
            trend={teamLoad.length ? `${formatNumber(teamLoad.length)} active` : ""}
            loading={loading}
          />
        </div>

        <section className="insights-section">
          <h3>
            <i className="fa-solid fa-robot" />
            AI Insights
            <span className="ml-1 text-[11px] font-medium text-[var(--text-tertiary)]">Live from workspace metrics</span>
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
              Task Completion
            </h3>
            {loading ? <div className="empty-state">Loading task analytics...</div> : <BarChart items={chartItems} />}
          </section>

          <section className="chart-card">
            <h3 className="chart-title">
              <i className="fa-solid fa-chart-pie" />
              Distribution
            </h3>
            {loading ? <div className="empty-state">Loading distribution...</div> : <DistributionChart items={distributionItems} />}
          </section>
        </div>

        <div className="bottom-grid">
          <section className="list-card">
            <h3 className="list-title">
              <i className="fa-solid fa-clock-rotate-left" />
              Recent Activity
            </h3>
            {activity.length ? (
              activity.slice(0, 6).map((item, index) => (
                <div className="activity-item" key={item.id || index}>
                  <div className="activity-avatar">{(item.actor?.name || item.user?.name || item.userName || "A").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="activity-text">
                      <strong>{item.actor?.name || item.user?.name || item.userName || "Workspace"}</strong>{" "}
                      {item.title || item.message || item.action || "updated the workspace"}
                    </div>
                    <div className="activity-time">{item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time || "Recent"}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No activity returned yet.</div>
            )}
          </section>

          <section className="list-card">
            <h3 className="list-title">
              <i className="fa-regular fa-calendar" />
              Upcoming Deadlines
            </h3>
            {upcomingItems.length ? (
              upcomingItems.map((item) => (
                <div className="upcoming-item" key={item.id}>
                  <div className="upcoming-date">{formatDate(item.date)}</div>
                  <div className="upcoming-title">
                    <strong>{item.title}</strong>
                  </div>
                  <span className="upcoming-badge">{item.status}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">No deadline data returned yet.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
