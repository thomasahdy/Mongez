import React from "react";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const BarTooltip = ({ active, payload, label }) => {
  const { dir } = useLocaleDirection();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg text-[12px]" dir={dir}>
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

export default BarTooltip
