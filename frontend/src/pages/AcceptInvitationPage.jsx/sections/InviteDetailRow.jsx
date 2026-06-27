import React from 'react'

const InviteDetailRow = ({ label, value, children }) => {
 return (
    <div className="flex items-center justify-between py-2 text-[13px] border-b border-slate-100 dark:border-slate-700 last:border-none last:pb-0 first:pt-0">
      <span className="text-slate-400 dark:text-slate-500 font-medium">{label}</span>
      {children ?? (
        <span className="font-semibold text-slate-800 dark:text-slate-100">{value}</span>
      )}
    </div>
  );
}

export default InviteDetailRow
