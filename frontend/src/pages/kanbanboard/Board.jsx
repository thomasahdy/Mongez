import React, { useEffect } from 'react'
import BoardColumn from './BoardColumn'
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useBoard, useCreateColumn, useReorderColumns } from '../../hooks/api/useBoards';
import { useTasks, useMoveTask } from '../../hooks/api/useTasks';
import CreateColumnModal from './CreateColumnModal';
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSocket } from '../../context/SocketContext';

const Board = ({id, columns }) => {
  const [showCreateColumnModal, setShowCreateColumnModal] = React.useState(false);
  const createColumn = useCreateColumn(id);
  const reorderColumns = useReorderColumns(id);
  const moveTask = useMoveTask();
  const { data: tasks = [], isLoading, isError } = useTasks(id);

  const { joinBoard, leaveBoard } = useSocket();

  useEffect(() => {
    joinBoard(id);
    return () => {
      leaveBoard(id);
    };
  }, [id, joinBoard, leaveBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreateColumn = (data) => {
    createColumn.mutate(data); 
  };

  const getColumnPos = (colId) => {
    return columns.findIndex((col) => col.id === colId);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    // 1. Check if dragging a column
    const isActiveColumn = columns.some((col) => col.id === active.id);

    if (isActiveColumn) {
      if (active.id === over.id) return;
      const originalPos = getColumnPos(active.id);
      const newPos = getColumnPos(over.id);
      if (originalPos === -1 || newPos === -1) return;

      const reorderedArray = [...columns];
      const [movedColumn] = reorderedArray.splice(originalPos, 1);
      reorderedArray.splice(newPos, 0, movedColumn);

      const payload = reorderedArray.map((col, index) => ({
        id: col.id,
        position: index 
      }));

      reorderColumns.mutate({ columns: payload });
    } else {
      // 2. Dragging a task
      if (active.id === over.id) return;
      
      const activeTask = tasks.find((t) => t.id === active.id);
      if (!activeTask) return;

      const isOverColumn = columns.some((col) => col.id === over.id);
      let targetColumnId;
      let targetPosition = 0;

      if (isOverColumn) {
        targetColumnId = over.id;
        const columnTasks = tasks.filter((t) => t.columnId === targetColumnId && t.id !== active.id);
        targetPosition = columnTasks.length;
      } else {
        const overTask = tasks.find((t) => t.id === over.id);
        if (!overTask) return;
        targetColumnId = overTask.columnId;

        const columnTasks = tasks.filter((t) => t.columnId === targetColumnId && t.id !== active.id);
        const overIndex = columnTasks.findIndex((t) => t.id === over.id);
        targetPosition = overIndex !== -1 ? overIndex : columnTasks.length;
      }

      moveTask.mutate({
        taskId: active.id,
        columnId: targetColumnId,
        position: targetPosition,
        boardId: id
      });
    }
  };

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
              <BoardColumn
                key={col.id}
                column={col}
                tasks={(tasks || []).filter((t) => t.columnId === col.id)}
                isLoading={isLoading}
                isError={isError}
              />
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
