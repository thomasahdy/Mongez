import React from 'react'
import OwnerBadge from '../../components/OwnerBadge'
import StatItem from '../../components/StatItem'
import Button from '../../components/Button'

const SpaceCardHeader = ({ space, expanded, onToggle, onInvite, onSettings, onMore }) => {
  return (
    <div
      className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`Toggle ${space.name}`}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
    >
      {/* Left: icon + name + meta */}
      <div className="flex items-center gap-3.5">
        {/* Space avatar */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white text-[15px] font-bold shrink-0 bg-gradient-to-br ${space.gradient}`}>
          {space.initials}
        </div>
 
        <div>
          <div className="flex items-center flex-wrap gap-1 text-[17px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
            {space.name}
            {space.isOwner && <OwnerBadge />}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-[12px]">
            <StatItem icon="fa-building"       label={`${space.stats.departments} Departments`} />
            <StatItem icon="fa-table-columns"  label={`${space.stats.boards} Boards`} />
            <StatItem icon="fa-users"          label={`${space.stats.members} Members`} />
          </div>
        </div>
      </div>
 
      {/* Right: action buttons */}
      <div className="flex items-center gap-2 ml-4 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="md" onClick={onInvite} aria-label={`Invite to ${space.name}`}>
          <i className="fa-solid fa-user-plus" /> <span className="hidden sm:inline">Invite</span>
        </Button>
        <Button variant="outline" size="md" onClick={onSettings} aria-label={`Settings for ${space.name}`}>
          <i className="fa-solid fa-gear" />
        </Button>
        <Button variant="outline" size="md" onClick={onMore} aria-label={`More options for ${space.name}`}>
          <i className="fa-solid fa-ellipsis" />
        </Button>
        {/* Expand / collapse chevron */}
        <i
          className={`fa-solid fa-chevron-down text-slate-400 text-[12px] transition-transform duration-200 ml-1 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default SpaceCardHeader
