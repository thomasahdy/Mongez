import React, { useState } from 'react'
import Button from '../../components/ui/Button';


const DATE_FILTERS = ["Last 30 Days", "This Quarter", "This Year"];

const ReportsToolbar = () => {
    const [activePeriod, setActivePeriod] = useState("Last 30 Days");
    return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm mb-6">
      {/* Date range */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Date range filter">
        {DATE_FILTERS.map((label) => (
          <Button
            key={label}
            variant="outline"
            size="md"
            active={activePeriod === label}
            onClick={() => setActivePeriod(label)}
            aria-pressed={activePeriod === label}
          >
            {label}
          </Button>
        ))}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" role="separator" aria-hidden="true" />

        <Button variant="outline" size="md">
          <i className="fa-regular fa-calendar text-[12px]" aria-hidden="true" />
          Custom Date
        </Button>
      </div>

      {/* Dropdowns */}
      <div className="flex items-center gap-2 shrink-0" role="group" aria-label="Scope filters">
        <Button variant="outline" size="md" aria-haspopup="listbox" aria-expanded="false">
          <i className="fa-regular fa-user text-[12px]" aria-hidden="true" />
          All Members
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="md" aria-haspopup="listbox" aria-expanded="false">
          <i className="fa-solid fa-folder-tree text-[12px]" aria-hidden="true" />
          All Spaces
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export default ReportsToolbar
