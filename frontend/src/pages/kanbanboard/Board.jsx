import React, { useEffect } from 'react'
import BoardColumn from './BoardColumn'
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMoveTaskQuery } from '../../hooks/useTaskListQueries';
import { useBoard, useCreateColumn, useReorderColumns } from '../../hooks/api/useBoards';
import CreateColumnModal from './CreateColumnModal';
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';


const Board = ({id, columns }) => {
  const [showCreateColumnModal, setShowCreateColumnModal] = React.useState(false);
  const createColumn = useCreateColumn(id);
  const reorderColumns = useReorderColumns(id);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  //create board columns and cards from the columns state
  //1-create board columns 
    //create form and handle form
    //create handle for form
  //2-create tasks
  

  const handleCreateColumn = (data) => {
    createColumn.mutate(data); 
  };

  const getColumnPos = (id) => {
    return columns.findIndex((col) => col.id === id);
  };


  const handleDragEnd = (event) => {
    const { active, over } = event;
  
  // Guard clause against empty drops or identical positions
  if (!over || active.id === over.id) return;

  const originalPos = getColumnPos(active.id);
  const newPos = getColumnPos(over.id);
  if (originalPos === -1 || newPos === -1) return;

  // 1. Create a shallow copy of the columns array so we don't mutate state directly
  const reorderedArray = [...columns];

  // 2. Remove the dragged column from its old index and store it
  const [movedColumn] = reorderedArray.splice(originalPos, 1);

  // 3. Insert the dragged column into its new target index
  reorderedArray.splice(newPos, 0, movedColumn);

  // 4. Construct the payload using sequential indices so EVERY affected column updates
  const payload = reorderedArray.map((col, index) => ({
    id: col.id,
    position: index // This smoothly shifts all intervening columns automatically
  }));

  // 5. Send to backend
  reorderColumns.mutate({ columns: payload });

    

  }

  return (
    <div
      className="flex-1 overflow-x-auto p-5 flex gap-4 items-start"
      role="region"
      aria-label="Kanban Board"
    >
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="column flex gap-4 items-start">
          <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <BoardColumn key={col.id} column={col} />
          ))}
          </SortableContext>
          
        </div>
      
      </DndContext>

      {/* Add group button */}
      <button
        className="w-[180px] min-w-[180px] h-fit flex items-center justify-center gap-2 p-4 rounded-xl text-[13px] font-medium text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-all duration-150 shrink-0"
        aria-label="Add new group"
        onClick={()=>setShowCreateColumnModal(true)}
      >
        <i className="fa-solid fa-plus" /> Add Group
      </button>

      {showCreateColumnModal && (
        <CreateColumnModal
          onClose={() => setShowCreateColumnModal(false)} 
          onSubmit={handleCreateColumn}
          boardId={id}
          spaceId={null} // Assuming spaceId is not relevant in this context
          spacePrefix={null} // Assuming spacePrefix is not relevant in this context
        />
      )}
    </div>


  )
}

export default Board
