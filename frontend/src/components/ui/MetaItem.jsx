import React from 'react'

const MetaItem = ({ icon, count, className = "" }) => {
  return (
    <div className={`flex items-center gap-1 text-slate-400 text-[11px] ${className}`}>
      <i className={icon} />
      {count}
    </div>
  );
}

export default MetaItem
