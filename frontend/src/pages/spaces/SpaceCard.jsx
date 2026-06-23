import React, { useState } from 'react';
import SpaceCardHeader from './SpaceCardHeader';
import DepartmentRow from './DepartmentRow';

/**
 * Component: SpaceCard
 * 
 * Renders a single workspace card with its departments, supporting toggle collapse,
 * edit actions, invite redirects, and deletion actions.
 * 
 * @param {Object} props
 * @param {Object} props.space - Space data record
 * @param {Function} props.onEdit - Edit workspace callback
 * @param {Function} props.onDelete - Delete workspace callback
 * @param {Function} props.onInvite - Invite members callback
 */
const SpaceCard = ({ space, onEdit, onDelete, onInvite }) => {
  const [expanded, setExpanded] = useState(true);

  const handleAddBoard = (deptId) => {
    console.info("Add board to dept:", deptId);
  };

  return (
    <article
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm animate-fadeIn"
      aria-label={`Space: ${space.name}`}
    >
      <SpaceCardHeader
        space={space}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onInvite={() => onInvite(space.id)}
        onSettings={() => onEdit(space)}
        onMore={() => onDelete(space.id)}
      />

      {/* Departments — animated collapse */}
      <div
        className={`transition-all duration-300 overflow-hidden ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
        aria-hidden={!expanded}
      >
        <div className="px-6 pb-5 pt-1">
          {space.departments && space.departments.length > 0 ? (
            space.departments.map((dept) => (
              <DepartmentRow key={dept.id} dept={dept} onAddBoard={handleAddBoard} />
            ))
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-3 pl-2">
              No departments registered in this space. Click settings to configure departments.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default SpaceCard;
