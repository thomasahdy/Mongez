import React from "react";
import TrendBadge from "./TrendBadge";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const MetricCard = ({ metric }) => {
  const { dir, isRtl } = useLocaleDirection();
  const { title, value, unit, icon, trend, accentColor, iconBg, iconColor } = metric;

  return (
    <article
      className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
      aria-label={`${title}: ${value}${unit ?? ""}`}
      dir={dir}
    >
      <div
        className={`absolute top-0 ${isRtl ? "right-0 rounded-r-xl" : "left-0 rounded-l-xl"} w-1 h-full`}
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

export default MetricCard
