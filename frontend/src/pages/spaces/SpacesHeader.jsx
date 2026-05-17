import React from 'react'
import Button from '../../components/ui/Button';

const SpacesHeader = ({ onNewSpace }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50 mb-1.5">
          Spaces &amp; Structure
        </h1>
        <p className="text-[14px] text-slate-500 dark:text-slate-400">
          Manage your organizational hierarchy: Spaces → Departments → Boards
        </p>
      </div>
      <Button variant="primary" size="lg" onClick={onNewSpace} aria-label="Create new space">
        <i className="fa-solid fa-plus" /> New Space
      </Button>
    </div>
  );
}

export default SpacesHeader
