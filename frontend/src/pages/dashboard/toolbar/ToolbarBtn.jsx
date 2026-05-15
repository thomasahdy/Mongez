import React from 'react'

const ToolbarBtn = ({ icon, title, children }) => {
  return (
    <button
      title={title}
      className="w-[30px] h-[30px] flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-150 text-[13px]"
      aria-label={title}
    >
      {children ?? <i className={`fa-solid ${icon}`} />}
    </button>
  )
}

export default ToolbarBtn
