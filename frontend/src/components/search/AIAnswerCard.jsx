import React from 'react'
import SourcePill from './SourcePill';

const AIAnswerCard = ({ answer }) => {
  return (
    <div
      className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-900/25 dark:to-purple-900/15 border border-indigo-200/60 dark:border-indigo-700/40 rounded-xl p-5 mb-5"
      role="region"
      aria-label="AI Answer"
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-widest mb-3">
        <i className="fa-solid fa-robot" aria-hidden="true" />
        AI Answer
      </div>

      {/* Answer text */}
      <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed mb-4">
        {answer.text.map((segment, i) =>
          segment.bold ? (
            <strong key={i} className="text-indigo-600 dark:text-indigo-300 font-semibold">
              {segment.value}
            </strong>
          ) : (
            <span key={i}>{segment.value}</span>
          )
        )}
      </p>

      {/* Sources */}
      <div className="flex flex-wrap gap-2" aria-label="Sources">
        {answer.sources.map((s, i) => (
          <SourcePill key={i} icon={s.icon} label={s.label} />
        ))}
      </div>
    </div>
  );
}

export default AIAnswerCard
