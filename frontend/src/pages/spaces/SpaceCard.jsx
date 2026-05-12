import React, { useState } from 'react'
import SpaceCardHeader from './SpaceCardHeader';
import DepartmentRow from './DepartmentRow';

const SpaceCard = ({ space }) => {
  const [expanded, setExpanded] = useState(true);
 
  const handleAddBoard = (deptId) => {
    // Wire to modal/router in real app
    console.info("Add board to dept:", deptId);
  };
 
  return (
    <article
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm"
      aria-label={`Space: ${space.name}`}
    >
      <SpaceCardHeader
        space={space}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onInvite={() => console.info("Invite to", space.id)}
        onSettings={() => console.info("Settings for", space.id)}
        onMore={() => console.info("More for", space.id)}
      />
 
      {/* Departments — animated collapse */}
      <div
        className={`transition-all duration-300 overflow-hidden ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
        aria-hidden={!expanded}
      >
        <div className="px-6 pb-5 pt-1">
          {space.departments.map((dept) => (
            <DepartmentRow key={dept.id} dept={dept} onAddBoard={handleAddBoard} />
          ))}
        </div>
      </div>
    </article>
  );
}

export default SpaceCard
