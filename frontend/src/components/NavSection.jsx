import React from 'react'

const NavSection = ({ label, actionHref, children }) => {
  return (
    <div className="mb-5 group">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        {actionHref && (
          <a href={actionHref} className="opacity-0 group-hover:opacity-100 w-[18px] h-[18px] flex items-center justify-center rounded text-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" aria-label={`Manage ${label}`}>
            <i className="fa-solid fa-gear" />
          </a>
        )}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  )
}

export default NavSection
