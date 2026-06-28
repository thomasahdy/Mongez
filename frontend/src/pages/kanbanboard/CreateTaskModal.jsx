import React from 'react'
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createTaskValidationSchema } from '../../schemas/taskValidationSchema';
import { useMembers } from '../../hooks/api/useMembers';

const CreateTaskModal = ({ boardId, columnId, spaceId, spacePrefix, onSubmit, onClose, defaultValues = {} }) => {
  const { data: members = [] } = useMembers(spaceId);
  const [selectedAssignees, setSelectedAssignees] = React.useState(defaultValues.assigneeIds || []);
  const [tagsText, setTagsText] = React.useState((defaultValues.tags || []).join(", "));

  const toggleAssignee = (id) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createTaskValidationSchema),
    defaultValues: {
      title: defaultValues.title || "",
      boardId: boardId || "",
      columnId: columnId || "",
      spaceId: spaceId || "",
      spacePrefix: spacePrefix || "",
      description: defaultValues.description || "",
      status: defaultValues.status || "TODO",
      priority: defaultValues.priority || "MEDIUM",
      type: defaultValues.type || "Task",
      dueDate: defaultValues.dueDate || "",
      startDate: defaultValues.startDate || "",
      estimatedHours: defaultValues.estimatedHours || 0,
      parentId: defaultValues.parentId || "",
      tags: defaultValues.tags || [],
      assigneeIds: defaultValues.assigneeIds || []
    },
  });console.log("Current Live Form Errors:", errors);

  const handleFormSubmit = async (data) => {
    // Convert numbers explicitly if needed
    if (data.estimatedHours) {
      data.estimatedHours = Number.parseInt(data.estimatedHours, 10);
    }
    data.assigneeIds = selectedAssignees;
    data.tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await onSubmit(data);
      reset();
      setSelectedAssignees([]);
      setTagsText("");
    } catch (err) {
      console.error("Task submission failed:", err);
    }
  };

  const handleInvalidSubmit = (valErrors) => {
    console.warn("CreateTaskModal handleSubmit validation FAILED:", valErrors);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Top subtle decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-900">
          <h2 id="modal-title" className="text-[18px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Create new task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <i className="fa-solid fa-xmark text-[16px]" />
          </button>
        </div>

        {/* Modal Form Container with Scroll capability */}
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto global-scrollbar">
          
          {/* Hidden contextual properties from parent context */}
          <input type="hidden" {...register('boardId')} />
          <input type="hidden" {...register('columnId')} />
          <input type="hidden" {...register('spaceId')} />
          <input type="hidden" {...register('spacePrefix')} />

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-title">
              Title *
            </label>
            <input
              id="task-title"
              type="text"
              placeholder="Fix navbar rendering bug"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                ${errors.title ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.title.message}
              </p>
            )}
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-desc">
              Description
            </label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Provide details about this task..."
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm resize-none
                ${errors.description ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('description')}
            />
          </div>

          {/* Dropdowns row: Type, Priority & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-type">
                Type
              </label>
              <select
                id="task-type"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-950 outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                {...register('type')}
              >
                <option value="Task">Task</option>
                <option value="Bug">Bug</option>
                <option value="Feature">Feature</option>
                <option value="Milestone">Milestone</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-950 outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                {...register('priority')}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-status">
                Status
              </label>
              <input
                id="task-status"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 text-sm cursor-not-allowed"
                disabled
                {...register('status')}
              />
            </div>
          </div>

          {/* Dates Row: Start Date & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-start-date">
                Start Date
              </label>
              <input
                id="task-start-date"
                type="datetime-local"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none text-sm"
                {...register('startDate')}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-due-date">
                Due Date
              </label>
              <input
                id="task-due-date"
                type="datetime-local"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none text-sm"
                {...register('dueDate')}
              />
            </div>
          </div>

          {/* Assignees Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Assignees
            </label>
            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
              {members.map((member) => {
                const id = member.user?.id || member.id;
                const name = member.user?.name || member.name || "Member";
                const isSelected = selectedAssignees.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => toggleAssignee(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-350 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
              {members.length === 0 && (
                <span className="text-xs text-slate-400 italic">No members in space.</span>
              )}
            </div>
          </div>

          {/* Tags Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-tags">
              Tags (comma-separated)
            </label>
            <input
              id="task-tags"
              type="text"
              placeholder="frontend, bug, high-priority"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none text-sm focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {/* Estimated Hours & Subtask parent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-estimate">
                Estimated Hours
              </label>
              <input
                id="task-estimate"
                type="number"
                placeholder="4"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                  ${errors.estimatedHours ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'}`}
                {...register('estimatedHours', { valueAsNumber: true })}
              />
              {errors.estimatedHours && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">
                  {errors.estimatedHours.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="task-parent">
                Parent Task ID (Subtasks)
              </label>
              <input
                id="task-parent"
                type="text"
                placeholder="Optional parent ID"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none text-sm"
                {...register('parentId')}
              />
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:shadow-md text-white transition-all duration-200 cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default CreateTaskModal;