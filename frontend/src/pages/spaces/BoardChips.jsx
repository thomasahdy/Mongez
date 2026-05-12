import React from 'react'
import BoardChip from './BoardChip'

const BoardChips = ({ boards, onAddBoard }) => {
  return (
    <div className="flex flex-wrap gap-2 mt-2.5 pl-[52px]" role="list" aria-label="Boards">
      {boards.map((b) => (
        <div key={b.id} role="listitem">
          <BoardChip board={b} />
        </div>
      ))}
      <button
        onClick={onAddBoard}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-400 border border-dashed border-slate-200 dark:border-slate-600 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-all duration-150"
        aria-label="Add new board"
      >
        <i className="fa-solid fa-plus text-[11px]" />
        Board
      </button>
    </div>
  )
}

export default BoardChips
