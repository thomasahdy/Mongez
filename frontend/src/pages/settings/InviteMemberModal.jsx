import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberSchema } from '../../schemas/validationSchemas';

/**
 * Component: InviteMemberModal
 * 
 * Renders a modal form to invite a user to the workspace.
 * Validates the email address and selected role.
 * 
 * @param {Object} props
 * @param {Function} props.onSubmit - Submission callback receiving { email, role }
 * @param {Function} props.onClose - Modal close handler
 */
export default function InviteMemberModal({ onSubmit, onClose }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const handleFormSubmit = async (data) => {
    try {
      await onSubmit(data);
      reset();
    } catch (err) {
      console.error("Invitation failed:", err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Header gradient banner */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-900">
          <h2 id="invite-title" className="text-[17px] font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-user-plus text-sky-500 text-sm" /> Invite Team Member
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
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-5">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Invite coworkers or collaborators to this workspace space. They will receive an email invitation to register or join.
          </p>

          {/* Email input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="invite-email">
              Email Address *
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="e.g. coworker@domain.com"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm
                ${errors.email ? 'border-red-500 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.email.message}
              </p>
            )}
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="invite-role">
              Workspace Role
            </label>
            <select
              id="invite-role"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none text-sm cursor-pointer"
              {...register('role')}
            >
              <option value="MEMBER">Member (Can create boards and tasks)</option>
              <option value="ADMIN">Admin (Can configure structure and manage members)</option>
              <option value="VIEWER">Viewer (Read-only access)</option>
            </select>
            {errors.role && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 font-medium flex items-center gap-1.5">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.role.message}
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
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:shadow-md text-white transition-all duration-200 cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending Invite...
                </>
              ) : (
                'Send Invitation'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
