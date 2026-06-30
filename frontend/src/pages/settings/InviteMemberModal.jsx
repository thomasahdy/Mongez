import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { inviteMemberSchema } from "../../schemas/validationSchemas";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function InviteMemberModal({ onSubmit, onClose }) {
  const { t } = useTranslation();
  const { dir, isRTL } = useLocaleDirection();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
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
      dir={dir}
    >
      <div className={`w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 ${isRTL ? "text-right" : "text-left"}`}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        <div className="flex items-center justify-between border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-900">
          <h2 id="invite-title" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            <i className="fa-solid fa-user-plus text-sm text-sky-500" /> {t("members.sections.inviteTeammate")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            aria-label={t("common.close")}
          >
            <i className="fa-solid fa-xmark text-[16px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 p-6">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t("members.sections.inviteDescription")}
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invite-email">
              {t("resetPassword.emailLabel")}
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder={t("members.labels.emailPlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.email ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invite-role">
              {t("members.breadcrumb")}
            </label>
            <select
              id="invite-role"
              className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-sky-400 dark:border-slate-800 dark:bg-slate-900"
              {...register("role")}
            >
              <option value="MEMBER">{t("members.roles.MEMBER")}</option>
              <option value="ADMIN">{t("members.roles.ADMIN")}</option>
              <option value="VIEWER">{t("members.roles.VIEWER")}</option>
            </select>
            {errors.role && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400">
                <i className="fa-solid fa-circle-exclamation text-[10px]" /> {errors.role.message}
              </p>
            )}
          </div>

          <div className={`flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-900 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("members.labels.sendingInvite")}
                </>
              ) : (
                t("members.labels.sendInvite")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
