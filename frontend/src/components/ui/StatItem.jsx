const StatItem = ({ icon, label }) => {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`fa-solid ${icon} text-[11px] text-slate-400`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default StatItem