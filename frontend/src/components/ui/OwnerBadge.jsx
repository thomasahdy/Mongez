import React from 'react'

const OwnerBadge = () => {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full ml-2">
      <i className="fa-solid fa-crown text-[10px]" aria-hidden="true" />
      Owner
    </span>
  );
}

export default OwnerBadge
