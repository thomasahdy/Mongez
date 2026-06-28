import React from 'react'

const InviterCard = ({ inviter }) => {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl mb-5">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center text-white text-[12px] font-bold shrink-0"
        aria-hidden="true"
      >
        {inviter.initials}
      </div>
 
      {/* Info */}
      <div className="text-left">
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {inviter.name}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{inviter.email}</p>
      </div>
    </div>
  );
}

export default InviterCard
