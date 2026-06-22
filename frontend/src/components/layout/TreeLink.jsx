import { NavLink } from 'react-router'

const TreeLink = ({ label, active, badge, hasAI, dotColor, to = "/spaces", onClick }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `flex items-center text-[13px] px-2 py-1 rounded-lg mb-0.5 transition-all duration-150 relative
        ${active
          ? "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 font-semibold"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
        }
        ${isActive ? "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 font-semibold" : ""}`}
    >
      {dotColor
        ? <i className="fa-solid fa-circle mr-2" style={{ fontSize: 5, color: dotColor }} />
        : <i className="fa-regular fa-folder mr-2 text-[11px] text-slate-400" />
      }
      {label}
      {badge && (
        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
          {badge}
          {hasAI && <i className="fa-solid fa-bolt text-sky-400 text-[10px]" title="AI insight available" />}
        </span>
      )}
    </NavLink>
  )
}

export default TreeLink
