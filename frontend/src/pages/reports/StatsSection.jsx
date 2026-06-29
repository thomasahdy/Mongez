import React, { useState } from 'react'
import MetricCard from '../../components/reports/MetricCard'
import { useDashboardStats } from '../../hooks/api/useAnalytics'

const StatsSection = ({spaceId}) => {


    const {data: metrics, isLoading, error} = useDashboardStats(spaceId);
    const rawMetrics = Array.isArray(metrics)
  ? metrics
  : (metrics?.metrics || []);

const normalizedMetrics = rawMetrics.map((metric) => ({
  ...metric,
  id: metric.id || metric.key || metric.name?.toLowerCase().replace(/\s+/g, "-"),

  title: metric.title || metric.label || "Untitled Metric",

  value: String(metric.value ?? metric.count ?? 0),

  unit: metric.unit ?? null,

  icon: metric.icon || "fa-chart-column",

  trend: {
    direction:
      metric.trend?.direction ||
      ((metric.change ?? 0) >= 0 ? "up" : "down"),

    label:
      metric.trend?.label ||
      `${Math.abs(metric.change ?? 0)}% from last month`,
  },

  accentColor: metric.accentColor || "#00a8e8",

  iconBg: metric.iconBg || "bg-sky-100 dark:bg-sky-900/40",

  iconColor: metric.iconColor || "text-sky-500",
}));
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading metrics...</p>
      </div>
    </div>
  );
}

if (error) {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-5 py-4 rounded-xl text-sm font-medium shadow-sm">
        Failed to load metrics. Please try again.
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
          Nothing to show here
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Metrics will appear once data is available.
        </p>
      </div>
    </div>
  );
}
    
  return (
    <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6"
        aria-label="Key performance metrics"
        >
        {normalizedMetrics.map((m) => (
            <MetricCard key={m.id} metric={m}/>
        ))}
    </section>
  )
}

export default StatsSection
