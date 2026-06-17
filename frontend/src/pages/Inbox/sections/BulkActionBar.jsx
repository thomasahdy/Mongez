import React from 'react'
import Button from '../../../components/ui/Button';

const BulkActionBar = ({ total, selectedCount, allSelected, onSelectAll, onMarkRead, onArchive }) => {
  const hasSelection = selectedCount > 0;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-3 shadow-xs"
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Select all checkbox */}
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => { if (el) el.indeterminate = hasSelection && !allSelected; }}
        onChange={(e) => onSelectAll(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-sky-500 cursor-pointer"
        aria-label="Select all notifications"
      />

      <span className="flex-1 text-[12px] text-slate-400 dark:text-slate-500">
        {hasSelection ? `${selectedCount} of ${total} selected` : "Select all"}
      </span>

      {/* Bulk action buttons */}
      <Button
        variant="outline"
        size="sm"
        onClick={onMarkRead}
        disabled={!hasSelection}
        className="disabled:opacity-40"
        aria-label="Mark selected as read"
      >
        <i className="fa-solid fa-check text-[10px]" aria-hidden="true" />
        Mark read
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onArchive}
        disabled={!hasSelection}
        className="disabled:opacity-40"
        aria-label="Archive selected"
      >
        <i className="fa-solid fa-box-archive text-[10px]" aria-hidden="true" />
        Archive
      </Button>
    </div>
  );
}

export default BulkActionBar
