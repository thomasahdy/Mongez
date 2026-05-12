import React from 'react'

const StatItem = ({ icon, label }) => {
  return (
    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
      <i className={`fa-solid ${icon} text-[11px]`} aria-hidden="true" />
      {label}
    </span>
  )
}

export default StatItem
