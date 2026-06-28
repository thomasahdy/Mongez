/**
 * Mongez — Analytics & Reports Page
 * Converted from HTML export → production-grade React + Tailwind + Recharts
 *
 * Component tree:
 *  ReportsPage
 *    ├─ Sidebar (shared)
 *    ├─ TopHeader
 *    └─ <main>
 *         ├─ ReportsPageHeader
 *         ├─ ReportsToolbar  (date range + member/space filters)
 *         ├─ AIInsightsPanel  → InsightCard ×N
 *         ├─ MetricsGrid      → MetricCard ×4
 *         ├─ ChartsRow (2/3 + 1/3)
 *         │    ├─ TaskVolumeChart  (Recharts BarChart)
 *         │    └─ TopPerformersList → PerformerRow ×N
 *         └─ ChartsRow (1/2 + 1/2)
 *              ├─ PriorityBreakdown → PriorityBar ×N
 *              └─ CumulativeFlowChart (Recharts AreaChart)
 */

import { useEffect, useState } from "react";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";

// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────

const DATE_FILTERS = ["Last 30 Days", "This Quarter", "This Year"];

const METRICS = [
  {
    id: "completed",
    title: "Tasks Completed",
    value: "428",
    unit: null,
    icon: "fa-check-double",
    trend: { direction: "up", label: "12% from last month" },
    accentColor: "#00a8e8",
    iconBg: "bg-sky-100 dark:bg-sky-900/40",
    iconColor: "text-sky-500",
  },
  {
    id: "ontime",
    title: "On-Time Rate",
    value: "84",
    unit: "%",
    icon: "fa-regular fa-clock",
    trend: { direction: "up", label: "4% from last month" },
    accentColor: "#10b981",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-500",
  },
  {
    id: "overdue",
    title: "Overdue Tasks",
    value: "32",
    unit: null,
    icon: "fa-triangle-exclamation",
    trend: { direction: "down", label: "8% from last month" },
    accentColor: "#f59e0b",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-500",
  },
  {
    id: "avg-time",
    title: "Avg. Completion Time",
    value: "2.4",
    unit: "days",
    icon: "fa-stopwatch",
    trend: { direction: "up", label: "0.5d faster", isPositive: true },
    accentColor: "#6366f1",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    iconColor: "text-indigo-500",
  },
];

const AI_INSIGHTS = [
  {
    id: "velocity",
    icon: "fa-arrow-trend-up",
    iconColor: "text-sky-500",
    title: "Velocity Increased",
    description:
      'The team completed 24% more tasks this month compared to last month. "Website Redesign" was the most active project.',
  },
  {
    id: "bottleneck",
    icon: "fa-triangle-exclamation",
    iconColor: "text-amber-500",
    title: "Bottleneck Detected",
    description:
      'Tasks in the "Design Review" column are averaging 4.2 days to resolution, which is 2× slower than the workspace average.',
  },
];

const BAR_CHART_DATA = [
  { week: "W1", created: 38, completed: 28 },
  { week: "W2", created: 55, completed: 47 },
  { week: "W3", created: 49, completed: 51 },
  { week: "W4", created: 74, completed: 68 },
  { week: "W5", created: 82, completed: 79 },
  { week: "W6", created: 68, completed: 63 },
];

const TOP_PERFORMERS = [
  { id: "sm", name: "Sarah Miller", initials: "SM", color: "#10b981", tasks: 124 },
  { id: "tu", name: "Thomas User",  initials: "TH", color: "#00a8e8", tasks: 98 },
  { id: "mr", name: "Marcus Reed",  initials: "MR", color: "#e74c3c", tasks: 86 },
  { id: "ed", name: "Emma Davis",   initials: "ED", color: "#f39c12", tasks: 72 },
];

const PRIORITIES = [
  { label: "Urgent", pct: 15, color: "#ef4444" },
  { label: "High",   pct: 35, color: "#f59e0b" },
  { label: "Normal", pct: 40, color: "#00a8e8" },
  { label: "Low",    pct: 10, color: "#94a3b8" },
];

const FLOW_DATA = [
  { day: "Apr 1", todo: 40, progress: 20, done: 10 },
  { day: "Apr 7", todo: 55, progress: 25, done: 18 },
  { day: "Apr 14", todo: 35, progress: 40, done: 30 },
  { day: "Apr 21", todo: 50, progress: 30, done: 45 },
  { day: "Apr 28", todo: 30, progress: 50, done: 60 },
  { day: "May 5",  todo: 20, progress: 35, done: 80 },
];

// ─────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────

/** Reusable button — primary / outline / ghost / active */
function Button({ children, variant = "outline", size = "md", active = false, onClick, className = "", ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 whitespace-nowrap";

  const variants = {
    primary: "bg-sky-500 border-sky-500 text-white hover:bg-sky-600",
    outline: active
      ? "bg-sky-100 dark:bg-sky-900/30 border-sky-400 text-sky-700 dark:text-sky-300"
      : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
    ghost: "border-transparent bg-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
  };

  const sizes = {
    sm: "text-[11px] px-2.5 py-1",
    md: "text-[13px] px-3 py-1.5",
    lg: "text-[13px] px-4 py-2",
  };

  return (
    <button
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Trend badge — arrow + label, colored by direction */
function TrendBadge({ direction, label, isPositive }) {
  // "up" is good unless isPositive === false (e.g. overdue tasks going up is bad)
  const isGood = direction === "up" ? (isPositive !== false) : isPositive === true;
  const colorClass = isGood ? "text-emerald-500" : "text-red-500";
  const arrowIcon = direction === "up" ? "fa-arrow-up" : "fa-arrow-down";

  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${colorClass}`}>
      <i className={`fa-solid ${arrowIcon} text-[10px]`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Reusable chart card wrapper */
function ChartCard({ title, children, headerRight, className = "" }) {
  return (
    <section
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm ${className}`}
      aria-label={title}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {headerRight && <div>{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────

/**
 * MetricCard
 * KPI card with colored left accent border, icon, large value, and trend indicator.
 * accentColor drives the left border — passed as inline style since Tailwind
 * can't construct arbitrary dynamic color values at runtime.
 */
function MetricCard({ metric }) {
  const { title, value, unit, icon, trend, accentColor, iconBg, iconColor } = metric;

  return (
    <article
      className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      aria-label={`${title}: ${value}${unit ?? ""}`}
    >
      {/* Left accent bar */}
      <div
        className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
        style={{ background: accentColor }}
        aria-hidden="true"
      />

      <div className="pl-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[14px] ${iconBg} ${iconColor}`}>
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[32px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-[16px] font-semibold text-slate-400">{unit}</span>
          )}
        </div>

        {/* Trend */}
        <TrendBadge
          direction={trend.direction}
          label={trend.label}
          isPositive={trend.isPositive}
        />
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────
// AI INSIGHTS PANEL
// ─────────────────────────────────────────────

function InsightCard({ insight }) {
  return (
    <div className="flex gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      <div className={`text-[20px] pt-0.5 shrink-0 ${insight.iconColor}`}>
        <i className={`fa-solid ${insight.icon}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">{insight.title}</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">{insight.description}</p>
      </div>
    </div>
  );
}

function AIInsightsPanel({ insights }) {
  return (
    <section
      className="bg-gradient-to-br from-indigo-50/60 to-sky-50/60 dark:from-indigo-900/20 dark:to-sky-900/10 border border-sky-200 dark:border-sky-800/50 rounded-xl p-6 mb-6"
      aria-label="AI Analysis Summary"
    >
      <div className="flex items-center gap-2 text-[14px] font-bold text-sky-700 dark:text-sky-300 mb-4">
        <i className="fa-solid fa-sparkles" aria-hidden="true" />
        AI Analysis Summary
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// REPORTS TOOLBAR
// ─────────────────────────────────────────────

/**
 * ReportsToolbar
 * Two filter groups: date range tabs + member/space dropdowns.
 * Date range active state is managed locally; lift to parent if needed.
 */
function ReportsToolbar() {
  const [activePeriod, setActivePeriod] = useState("Last 30 Days");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm mb-6">
      {/* Date range */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Date range filter">
        {DATE_FILTERS.map((label) => (
          <Button
            key={label}
            variant="outline"
            size="md"
            active={activePeriod === label}
            onClick={() => setActivePeriod(label)}
            aria-pressed={activePeriod === label}
          >
            {label}
          </Button>
        ))}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" role="separator" aria-hidden="true" />

        <Button variant="outline" size="md">
          <i className="fa-regular fa-calendar text-[12px]" aria-hidden="true" />
          Custom Date
        </Button>
      </div>

      {/* Dropdowns */}
      <div className="flex items-center gap-2 shrink-0" role="group" aria-label="Scope filters">
        <Button variant="outline" size="md" aria-haspopup="listbox" aria-expanded="false">
          <i className="fa-regular fa-user text-[12px]" aria-hidden="true" />
          All Members
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="md" aria-haspopup="listbox" aria-expanded="false">
          <i className="fa-solid fa-folder-tree text-[12px]" aria-hidden="true" />
          All Spaces
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TASK VOLUME CHART (Recharts BarChart)
// ─────────────────────────────────────────────

const BAR_VIEW_TABS = ["Weekly", "Monthly"];

/** Custom tooltip for the bar chart */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5" style={{ color: entry.fill }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.fill }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function TaskVolumeChart({ data }) {
  const [activeView, setActiveView] = useState("Weekly");

  return (
    <ChartCard
      title="Task Volume vs Completion"
      headerRight={
        <div className="flex gap-1" role="group" aria-label="Chart view period">
          {BAR_VIEW_TABS.map((tab) => (
            <Button
              key={tab}
              variant="outline"
              size="sm"
              active={activeView === tab}
              onClick={() => setActiveView(tab)}
              aria-pressed={activeView === tab}
            >
              {tab}
            </Button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="30%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Bar dataKey="created"   name="Created"   fill="#00a8e8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// TOP PERFORMERS LIST
// ─────────────────────────────────────────────

function PerformerRow({ performer, rank }) {
  const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
  const rankIcons  = ["fa-trophy", "fa-medal", "fa-medal"];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-700/60 last:border-none last:pb-0">
      {/* Rank */}
      <span className={`text-[12px] w-5 text-center ${rankColors[rank] ?? "text-slate-300"}`}>
        {rank < 3
          ? <i className={`fa-solid ${rankIcons[rank]}`} aria-label={`Rank ${rank + 1}`} />
          : <span className="text-slate-400 text-[11px]">{rank + 1}</span>
        }
      </span>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
        style={{ background: performer.color }}
        aria-hidden="true"
      >
        {performer.initials}
      </div>

      {/* Name */}
      <p className="flex-1 text-[14px] font-semibold text-slate-700 dark:text-slate-200 truncate">
        {performer.name}
      </p>

      {/* Task count */}
      <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800 dark:text-slate-100 shrink-0">
        {performer.tasks}
        <i className="fa-solid fa-check text-[10px] text-emerald-500" aria-label="tasks completed" />
      </div>
    </div>
  );
}

function TopPerformersList({ performers }) {
  return (
    <ChartCard title="Top Performers">
      <div role="list" aria-label="Top performers by tasks completed">
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
        aria-label="View full team list"
      >
        View Full Team List
      </Button>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// PRIORITY BREAKDOWN
// ─────────────────────────────────────────────

function PriorityBar({ item }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-semibold">{item.pct}%</span>
      </div>
      {/* Track */}
      <div
        className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={item.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.label}: ${item.pct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${item.pct}%`, background: item.color }}
        />
      </div>
    </div>
  );
}

function PriorityBreakdown({ priorities }) {
  return (
    <ChartCard title="Tasks by Priority">
      <div className="flex flex-col gap-5">
        {priorities.map((p) => (
          <PriorityBar key={p.label} item={p} />
        ))}
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// CUMULATIVE FLOW CHART (Recharts AreaChart)
// ─────────────────────────────────────────────

/** Custom tooltip for area chart */
function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5" style={{ color: entry.stroke }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.fill }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function CumulativeFlowChart({ data }) {
  return (
    <ChartCard title="Cumulative Flow Diagram">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradProgress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00a8e8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00a8e8" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradTodo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<AreaTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area type="monotone" dataKey="todo"     name="To Do"      stroke="#f59e0b" fill="url(#gradTodo)"     strokeWidth={2} />
          <Area type="monotone" dataKey="progress" name="In Progress" stroke="#00a8e8" fill="url(#gradProgress)" strokeWidth={2} />
          <Area type="monotone" dataKey="done"     name="Done"       stroke="#10b981" fill="url(#gradDone)"     strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────
// TOP HEADER
// ─────────────────────────────────────────────

function TopHeader() {
  const [focused, setFocused] = useState(false);

  return (
    <header className="h-14 px-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 shrink-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-slate-400 shrink-0">
        <span>Al-Noor Foundation</span>
        <i className="fa-solid fa-chevron-right text-[9px] text-slate-300" aria-hidden="true" />
        <span className="text-slate-800 dark:text-slate-100 font-semibold">Reports</span>
      </nav>

      {/* Search */}
      <div className="flex-1 max-w-[480px]">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200
            ${focused
              ? "bg-white dark:bg-slate-800 border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
              : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
            }`}
        >
          <i className="fa-solid fa-magnifying-glass text-slate-400 text-[13px]" aria-hidden="true" />
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-[12px]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search reports or ask AI..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search reports"
          />
          <kbd className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-slate-400 font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5">
          {[
            { icon: "fa-download",   label: "Export" },
            { icon: "fa-share-nodes", label: "Share" },
            { icon: "fa-robot",      label: "AI Agents", badge: "New" },
          ].map(({ icon, label, badge }) => (
            <Button key={label} variant="outline" size="md" className="relative">
              <i className={`fa-solid ${icon}`} aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] font-bold px-1.5 rounded-full uppercase leading-4">
                  {badge}
                </span>
              )}
            </Button>
          ))}
        </div>

        <button className="relative p-1.5" aria-label="Notifications">
          <i className="fa-regular fa-bell text-slate-500 text-[17px]" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" aria-hidden="true" />
        </button>

        <a
          href="/settings"
          className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-[11px] font-bold"
          aria-label="Profile settings"
        >
          TA
        </a>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR (shared — identical to SpacesPage)
// ─────────────────────────────────────────────

const OVERVIEW_NAV = [
  { href: "#my-work",   icon: "fa-circle-check",     label: "My Work",     badge: { label: "5", variant: "danger" } },
  { href: "#inbox",     icon: "fa-inbox",            label: "Inbox",        badge: { label: "3", variant: "danger" } },
  { href: "#dashboard", icon: "fa-chart-pie",        label: "Dashboard" },
  { href: "#search",    icon: "fa-magnifying-glass", label: "Search",       kbd: "⌘K" },
  { href: "#ai",        icon: "fa-sparkles",         label: "AI Assistant", iconColor: "#6366f1", aiBadge: true },
];

const VIEWS_NAV = [
  { href: "#calendar",   icon: "fa-calendar",       label: "Calendar",   badge: { label: "2 mtgs", variant: "neutral" } },
  { href: "#timeline",   icon: "fa-bars-staggered", label: "Timeline" },
  { href: "#whiteboard", icon: "fa-chalkboard",     label: "Whiteboard" },
  { href: "#reports",    icon: "fa-chart-line",     label: "Reports",    active: true },
];

function SidebarNavItem({ href, icon, iconColor, label, badge, kbd, aiBadge, active }) {
  const badgeVariants = {
    danger:  "bg-red-500 text-white",
    neutral: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300",
  };
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150
        ${active
          ? "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 font-semibold"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
        }`}
      aria-current={active ? "page" : undefined}
    >
      <span className="w-5 flex justify-center text-[13px] shrink-0" style={iconColor ? { color: iconColor } : {}}>
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeVariants[badge.variant] ?? badgeVariants.neutral}`}>
          {badge.label}
        </span>
      )}
      {kbd && (
        <kbd className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded font-mono text-slate-400">
          {kbd}
        </kbd>
      )}
      {aiBadge && (
        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-sky-400 text-white">AI</span>
      )}
    </a>
  );
}

function SidebarSection({ label, children, actionHref }) {
  return (
    <div className="mb-5 group">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        {actionHref && (
          <a
            href={actionHref}
            className="opacity-0 group-hover:opacity-100 w-[18px] h-[18px] flex items-center justify-center rounded text-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            aria-label={`Manage ${label}`}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      className="w-[260px] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col px-3 py-4 overflow-y-auto shrink-0"
      aria-label="Sidebar navigation"
    >
      <a
        href="/"
        className="flex items-center gap-2.5 px-2 py-1 mb-5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Mongez home"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500 shrink-0">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M8 22V10l5 8 5-8v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="10" r="2" fill="#a5b4fc" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">Mongez</span>
      </a>

      <SidebarSection label="Overview">
        {OVERVIEW_NAV.map((item) => <SidebarNavItem key={item.label} {...item} />)}
      </SidebarSection>

      <SidebarSection label="Views">
        {VIEWS_NAV.map((item) => <SidebarNavItem key={item.label} {...item} />)}
      </SidebarSection>

      <SidebarSection label="Spaces" actionHref="/spaces">
        <div className="px-2 py-[7px] rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center gap-2 text-[13px] font-medium text-slate-800 dark:text-slate-200 mb-1">
          <span className="w-5 flex justify-center shrink-0">
            <i className="fa-solid fa-graduation-cap text-red-500" aria-hidden="true" />
          </span>
          <span>Education Dept</span>
          <span className="ml-auto text-[10px] font-semibold bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Head</span>
        </div>
        <SidebarNavItem href="#health" icon="fa-hospital"  iconColor="#3498db" label="Health Dept"  badge={{ label: "2", variant: "neutral" }} />
        <SidebarNavItem href="#ops"    icon="fa-gears"     iconColor="#f39c12" label="Operations"   badge={{ label: "5", variant: "neutral" }} />
        <SidebarNavItem href="/spaces" icon="fa-plus"      label="Manage Spaces" />
      </SidebarSection>

      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-px">
        <SidebarNavItem href="/settings" icon="fa-gear" label="Settings" />
        <a
          href="/login"
          className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-150"
        >
          <span className="w-5 flex justify-center shrink-0">
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
          </span>
          Log out
        </a>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────

/**
 * ReportsPage
 * Full-page analytics dashboard.
 * Route: /reports
 *
 * Example:
 *   <Route path="/reports" element={<ReportsPage />} />
 */


 let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"Reports",
    color:"text-slate-800",
    ref:""
  },
  
]
export default function ReportsPagee({setPath}) {
  const { isRTL } = useLocaleDirection();

    useEffect(()=>{
      setPath(path)
    }, [path]);
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans" dir={isRTL ? "rtl" : "ltr"}>
        {/* Sidebar — hidden on mobile */}
        
        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto" aria-label="Analytics and reports">
            <div className="px-6 py-6 max-w-[1400px] mx-auto">

              {/* Page title */}
              <div className={`flex items-end justify-between gap-4 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className={isRTL ? "text-right" : "text-left"}>
                  <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50 mb-1.5">
                    Workspace Analytics
                  </h1>
                  <p className="text-[14px] text-slate-500 dark:text-slate-400 max-w-xl">
                    Monitor team performance, task velocity, and resource allocation across Al-Noor Foundation.
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <ReportsToolbar />

              {/* AI Insights */}
              <AIInsightsPanel insights={AI_INSIGHTS} />

              {/* KPI metrics */}
              <section
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6"
                aria-label="Key performance metrics"
              >
                {METRICS.map((m) => (
                  <MetricCard key={m.id} metric={m} />
                ))}
              </section>

              {/* Charts row 1: bar chart (2/3) + top performers (1/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <TaskVolumeChart data={BAR_CHART_DATA} />
                </div>
                <TopPerformersList performers={TOP_PERFORMERS} />
              </div>

              {/* Charts row 2: priority breakdown (1/2) + cumulative flow (1/2) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                <PriorityBreakdown priorities={PRIORITIES} />
                <CumulativeFlowChart data={FLOW_DATA} />
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
