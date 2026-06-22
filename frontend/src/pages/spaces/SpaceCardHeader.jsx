import React from 'react';
import OwnerBadge from '../../components/ui/OwnerBadge';
import StatItem from '../../components/ui/StatItem';
import Button from '../../components/ui/Button';

/**
 * Component: SpaceCardHeader
 * 
 * Header segment of the SpaceCard. Exposes interactive action buttons.
 * 
 * @param {Object} props
 * @param {Object} props.space - Space data record
 * @param {boolean} props.expanded - Collapse status
 * @param {Function} props.onToggle - Toggle collapse callback
 * @param {Function} props.onInvite - Invite click handler
 * @param {Function} props.onSettings - Edit settings click handler
 * @param {Function} props.onMore - Delete/archive click handler
 */
const SpaceCardHeader = ({ space, expanded, onToggle, onInvite, onSettings, onMore }) => {
  return (
    <div
      className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
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
        {/* Invite button */}
        <Button variant="outline" size="md" onClick={onInvite} aria-label={`Invite members to ${space.name}`}>
          <i className="fa-solid fa-user-plus text-sky-500" /> <span className="hidden sm:inline">Invite</span>
        </Button>
        
        {/* Edit Settings button */}
        <Button variant="outline" size="md" onClick={onSettings} aria-label={`Edit settings for ${space.name}`} title="Workspace Settings">
          <i className="fa-solid fa-gear text-slate-500 dark:text-slate-400" />
        </Button>

        {/* Delete Space button (Only allowed for Owners/Admins in business logic) */}
        {(space.isOwner || space.role === 'OWNER' || space.role === 'ADMIN') && (
          <Button 
            variant="outline" 
            size="md" 
            onClick={onMore} 
            aria-label={`Delete ${space.name}`} 
            title="Delete Space"
            className="hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/20"
          >
            <i className="fa-solid fa-trash-can text-red-500" />
          </Button>
        )}

        {/* Expand / collapse chevron */}
        <i
          className={`fa-solid fa-chevron-down text-slate-400 text-[12px] transition-transform duration-200 ml-1.5 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default SpaceCardHeader;
