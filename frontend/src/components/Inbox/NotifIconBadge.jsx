import React from 'react'

const NotifIconBadge = ({ bg, color, icon }) => {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] ${bg} ${color}`}
      aria-hidden="true"
    >
      <i className={`fa-solid ${icon}`} />
    </div>
  );
}

export default NotifIconBadge
