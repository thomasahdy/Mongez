import React, { useEffect } from 'react';
import TaskCard from './TaskCard';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CreateTaskModal from './CreateTaskModal';
import { useAppContext } from '../AppContext'; // 1. Import your actual context hook
import { useCreateTask } from '../../hooks/api/useTasks';

const BoardColumn = ({ column, tasks = [], isLoading, isError }) => {
  const { id, name, color, boardId } = column;
  const [showCreateTaskModal, setShowCreateTaskModal] = React.useState(false);
  
  const { activeSpace, activeBoard } = useAppContext();

  const createTask = useCreateTask();

  // useEffect(() => {console.log("BoardColumn tasks:", tasks)}, [tasks]);
  // dnd-kit setup
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform) };

  const handleTaskSubmit = async (taskData) => {
    // This will send to your useMutation hook
    console.log("Submitting Task Data:", taskData);
    createTask.mutate({board: activeBoard,
        taskData: {
          ...taskData,
          columnId: column.id
        }});
    setShowCreateTaskModal(false);
  };


  return (
    <section ref={setNodeRef} style={style} className="w-[300px] min-w-[300px] flex flex-col gap-2 shrink-0">
      
      {/* Column Header handles dragging */}
      <div {...attributes} {...listeners} className="flex items-center justify-between cursor-grab active:cursor-grabbing select-none mb-2">
        <span style={color ? { color } : {}} className="font-bold text-[14px]">{name}</span>
      </div>

      {/* Cards List Layout */}
      <div role="list" className="flex flex-col gap-2 flex-1 overflow-y-auto">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks?.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>

      {/* Add Task Trigger */}
      <button
        type="button"
        className="py-2 rounded-lg text-[12px] text-slate-400 border border-dashed border-slate-200 hover:border-sky-400 hover:text-sky-500 transition-all cursor-pointer"
        onClick={() => setShowCreateTaskModal(true)}
      >
        <i className="fa-solid fa-plus" /> Add Task
      </button>

      {/* 3. Pass values from activeSpace object safely down to the modal */}
      {showCreateTaskModal && (
        <CreateTaskModal
          boardId={boardId}
          columnId={id}
          spaceId={activeSpace?.id || ""}
          spacePrefix={activeSpace?.prefix || activeSpace?.code || ""} // Matches your backend space property
          onSubmit={handleTaskSubmit}
          onClose={() => setShowCreateTaskModal(false)}
        />
      )}
    </section>
  );
};

export default BoardColumn;