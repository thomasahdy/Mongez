import { useEffect, useState } from "react";
import Button from '../../components/ui/Button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import TrendBadge from "../../components/reports/TrendBadge";
import ChartCard from "../../components/reports/ChartCard";
import ReportsToolbar from "./ReportsToolbar";
import MetricCard from "../../components/reports/MetricCard";
import AIInsightsPanel from "./AIInsightsPanel";
import TaskVolumeChart from "./TaskVolumeChart";
import TopPerformersList from "./TopPerformersList";
import PriorityBreakdown from "./PriorityBreakdown";
import CumulativeFlowChart from "./CumulativeFlowChart";

// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────


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


const ReportsPage = ({setPath}) => {
  useEffect(()=>{
      setPath(path)
    }, [path]);
  return (
    <>
      

      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
        
        
        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto" aria-label="Analytics and reports">
            <div className="px-6 py-6 max-w-[1400px] mx-auto">

              {/* Page title */}
              <div className="flex items-end justify-between gap-4 mb-6">
                <div>
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

export default ReportsPage
