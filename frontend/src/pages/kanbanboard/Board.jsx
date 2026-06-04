import React from 'react'
import BoardColumn from './BoardColumn'

const Board = ({columns}) => {
  return (
    <div
      className="flex-1 overflow-x-auto p-5 flex gap-4 items-start"
      role="region"
      aria-label="Kanban Board"
    >
      
      {columns.map((col) => (
        <BoardColumn key={col.id} column={col} />
      ))}

      {/* Add group button */}
      <button
        className="w-[180px] min-w-[180px] h-fit flex items-center justify-center gap-2 p-4 rounded-xl text-[13px] font-medium text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-all duration-150 shrink-0"
        aria-label="Add new group"
      >
        <i className="fa-solid fa-plus" /> Add Group
      </button>
    </div>
  )
}

export default Board
