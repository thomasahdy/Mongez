import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { createBoardSchema } from '../../schemas/validationSchemas';

const CreateBoardModal = ({ dept, onSubmit, onClose }) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      name: '', // Empty defaults so placeholders show up correctly
      description: '',
      departmentId: dept?.id || '',
      type: 'KANBAN'
    },
  });

  useEffect(() => {
    if (dept?.id) {
      setValue('departmentId', dept.id);
    }
    
  }, [dept?.id,  setValue]);

  const handleFormSubmit = async (data) => {
    try {
      console.log(await onSubmit(data));
      reset();
    } catch (err) {
      console.error("Form submission failed:", err);
    }
  };

  const handleInvalidSubmit = (valErrors) => {
    console.warn("CreateBoardModal validation FAILED:", valErrors);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Top subtle decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-900">
          <h2 id="modal-title" className="text-[18px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Create new board in {dept?.name}
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

        {/* Modal Form — FIXED: Used onSubmit instead of action */}
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="p-6 space-y-4">
          
          {/* Name input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="board-name">
              Board Name
            </label>
            <input
              id="board-name"
              type="text"
              placeholder="e.g., Q3 Product Roadmap"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                ${errors.name ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.name.message}
              </p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="board-description">
              Description
            </label>
            <input
              id="board-description"
              type="text"
              placeholder="e.g., Tracking deliverables for engineering squads"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                ${errors.description ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('description')}
            />
            {/* FIXED: Swapped out errors.name for errors.description */}
            {errors.description && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.description.message}
              </p>
            )}
          </div>
          <div>
            <input type="hidden" {...register('departmentId')} />
          </div>
          <select
            id="type"
            {...register("type")}
            className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
              ${
                errors.role
                  ? "border-red-500 dark:border-red-900/50"
                  : "border-slate-200 dark:border-slate-800"
              }`}
          >
            <option value="KANBAN">Kanban</option>
            <option value="LIST">List</option>
            <option value="TABLE">Table</option>
            <option value="TIMELINE">Timeline</option>
            <option value="CALENDAR">Calendar</option>
            <option value="WHITEBOARD">Whiteboard</option>
            
          </select>

          {/* Modal Actions */}
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
                "Create Board"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateBoardModal;