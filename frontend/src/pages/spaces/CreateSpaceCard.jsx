import React from 'react'

const CreateSpaceCard = ({ remaining, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/40 dark:hover:bg-sky-900/10 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      aria-label="Create a new space"
    >
      <i className="fa-solid fa-plus text-[32px]" aria-hidden="true" />
      <span className="text-[14px] font-semibold">Create a New Space</span>
      <span className="text-[12px] font-normal">{remaining} spaces remaining on your plan</span>
    </button>
  )
}

export default CreateSpaceCard
