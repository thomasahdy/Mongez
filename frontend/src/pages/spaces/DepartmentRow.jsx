import React from 'react'
import Button from '../../components/Button';
import StatItem from '../../components/StatItem';
import BoardChips from './BoardChips';

const DepartmentRow = ({ dept, onAddBoard }) => {
  return (
    <div>
      {/* Row */}
      <div
        className="flex items-center gap-4 px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-lg mt-2.5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all duration-200 cursor-pointer group"
        role="button"
        tabIndex={0}
        aria-label={`Department: ${dept.name}`}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}
      >
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dept.iconBg}`}>
          <i className={`fa-solid ${dept.icon} text-[15px] ${dept.iconColor}`} aria-hidden="true" />
        </div>
 
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 truncate">{dept.name}</p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 truncate">
            Lead: {dept.lead} · {dept.memberCount} members
          </p>
        </div>
 
        {/* Stats — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400 shrink-0">
          <StatItem icon="fa-table-columns" label={`${dept.stats.boards} Boards`} />
          <StatItem icon="fa-list-check"    label={`${dept.stats.tasks} Tasks`} />
        </div>
 
        {/* Add board */}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onAddBoard(dept.id); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Add board to ${dept.name}`}
        >
          <i className="fa-solid fa-plus" /> Board
        </Button>
      </div>
 
      {/* Board chips below the row */}
      {dept.boards.length > 0 && (
        <BoardChips boards={dept.boards} onAddBoard={() => onAddBoard(dept.id)} />
      )}
    </div>
  )
}

export default DepartmentRow
