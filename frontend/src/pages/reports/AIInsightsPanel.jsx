import React from 'react'
import InsightCard from '../../components/reports/InsightCard';

const AIInsightsPanel = ({ insights }) => {
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

export default AIInsightsPanel
