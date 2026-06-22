import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSpaceSchema } from '../../schemas/validationSchemas';

/**
 * Component: CreateSpaceModal
 * 
 * Renders a dialog modal with a validated form for creating or updating a workspace.
 * Uses react-hook-form + Zod schemas for input validation.
 * 
 * @param {Object} props
 * @param {boolean} [props.isEdit=false] - Whether the modal is in edit/update mode
 * @param {Object} [props.space] - Space details when editing
 * @param {Function} props.onSubmit - Submission callback receiving validated form data
 * @param {Function} props.onClose - Modal close handler
 */
export default function CreateSpaceModal({ isEdit = false, space, onSubmit, onClose }) {
  // Set up React Hook Form with Zod validation schema
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: {
      name: space?.name || '',
      description: space?.description || '',
      prefix: space?.prefix || '',
      icon: space?.icon || 'fa-building',
      color: space?.color || '#6366f1',
    },
  });

  // Log errors dynamically to assist in debugging validation blocks
  console.log("CreateSpaceModal Form Errors:", errors);

  const handleInvalidSubmit = (valErrors) => {
    console.warn("CreateSpaceModal handleSubmit validation FAILED:", valErrors);
  };

  const handleFormSubmit = async (data) => {
    console.log("CreateSpaceModal handleFormSubmit data:", data);
    try {
      await onSubmit(data);
      reset();
    } catch (err) {
      console.error("Form submission failed:", err);
    }
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
            {isEdit ? 'Workspace Settings' : 'Create a New Space'}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="p-6 space-y-4">
          
          {/* Name input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="space-name">
              Workspace Name *
            </label>
            <input
              id="space-name"
              type="text"
              placeholder="e.g. Hope Foundation, Engineering Dept"
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

          {/* Description input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="space-desc">
              Description
            </label>
            <textarea
              id="space-desc"
              rows={3}
              placeholder="Provide a brief summary of what is managed in this space..."
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                ${errors.description ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.description.message}
              </p>
            )}
          </div>

          {/* Prefix input (Only editable during creation) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="space-prefix">
              Task Key Prefix {isEdit && '(Cannot change)'}
            </label>
            <input
              id="space-prefix"
              type="text"
              disabled={isEdit}
              placeholder="e.g. EDU, ENG, MKT (Default: PRJ)"
              maxLength={5}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm uppercase font-semibold tracking-wide
                ${isEdit ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : ''}
                ${errors.prefix ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('prefix')}
            />
            {errors.prefix && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.prefix.message}
              </p>
            )}
            {!isEdit && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                This tag will prefix all tasks created inside this space (e.g. EDU-1, EDU-2).
              </p>
            )}
          </div>

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
              onClick={() => console.log("CreateSpaceModal Submit button was clicked directly! isSubmitting:", isSubmitting)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:shadow-md text-white transition-all duration-200 cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                isEdit ? 'Save Changes' : 'Create Workspace'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
