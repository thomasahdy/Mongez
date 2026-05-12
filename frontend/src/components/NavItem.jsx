import React from 'react'
import Badge from './Badge'

const NavItem = ({ href, icon, iconColor, label, badge, kbd, aiBadge, active }) => {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer
        ${active
          ? "bg-sky-100 text-sky-800 font-semibold dark:bg-sky-900/30 dark:text-sky-300"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
    >
      <span className="w-5 flex justify-center text-[13px]" style={iconColor ? { color: iconColor } : {}}>
        <i className={`fa-solid ${icon}`} />
      </span>
      <span>{label}</span>
      {badge && <Badge variant={badge.variant} className="ml-auto">{badge.label}</Badge>}
      {kbd && <kbd className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded font-mono text-slate-400">{kbd}</kbd>}
      {aiBadge && (
        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-sky-400 text-white">AI</span>
      )}
    </a>
  )
}

export default NavItem
