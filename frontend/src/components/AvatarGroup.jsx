import React from 'react'
import Avatar from './Avatar';

const AvatarGroup = ({ avatars, extra = 0 }) => {
  return (
    <div className="flex items-center">
      {avatars.map((av, i) => (
        <span key={i} className={i > 0 ? "-ml-1.5 border-2 border-white dark:border-slate-800 rounded-full" : ""}>
          <Avatar initials={av.initials} color={av.color} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="ml-1 text-[11px] text-slate-400">+{extra}</span>
      )}
    </div>
  );
}

export default AvatarGroup
