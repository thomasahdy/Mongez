import React from 'react'

const Avatar = ({ initials, color = "#6366f1", size = "sm" }) => {
    const dim = size === "sm" ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]";
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ background: color }}
      aria-label={`Avatar for ${initials}`}
    >
      {initials}
    </span>
  );
  
}


export default Avatar
