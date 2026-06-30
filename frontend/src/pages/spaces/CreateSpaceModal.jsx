import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createSpaceSchema } from "../../schemas/validationSchemas";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function CreateSpaceModal({ isEdit = false, space, onSubmit, onClose }) {
  const { t } = useTranslation();
  const { dir, isRTL } = useLocaleDirection();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: {
      name: space?.name || "",
      description: space?.description || "",
      prefix: space?.prefix || "",
      icon: space?.icon || "fa-building",
      color: space?.color || "#6366f1",
    },
  });

  const handleInvalidSubmit = (validationErrors) => {
    console.warn("CreateSpaceModal handleSubmit validation FAILED:", validationErrors);
  };

  const handleFormSubmit = async (data) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title" dir={dir}>
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fadeIn dark:border-slate-800 dark:bg-slate-950 ${isRTL ? "text-right" : "text-left"}`}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4 pt-6 dark:border-slate-900">
          <h2 id="modal-title" className="text-[18px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {isEdit ? t("spacesPage.workspaceSettings") : t("spacesPage.createSpaceTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            aria-label={t("spacesPage.closeDialog")}
          >
            <i className="fa-solid fa-xmark text-[16px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="space-name">
              {t("spacesPage.workspaceName")}
            </label>
            <input
              id="space-name"
              type="text"
              placeholder={t("spacesPage.workspaceNamePlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.name ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("name")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="space-desc">
              {t("spacesPage.description")}
            </label>
            <textarea
              id="space-desc"
              rows={3}
              placeholder={t("spacesPage.workspaceDescriptionPlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.description ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("description")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="space-prefix">
              {t("spacesPage.taskKeyPrefix")} {isEdit ? t("spacesPage.cannotChange") : ""}
            </label>
            <input
              id="space-prefix"
              type="text"
              disabled={isEdit}
              placeholder={t("spacesPage.taskKeyPrefixPlaceholder")}
              maxLength={5}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wide outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                isEdit ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900" : ""
              } ${errors.prefix ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"}`}
              {...register("prefix")}
            />
            {!isEdit ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                {t("spacesPage.taskKeyPrefixHint")}
              </p>
            ) : null}
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
              {isSubmitting ? t("spacesPage.saving") : isEdit ? t("spacesPage.saveChanges") : t("spacesPage.createWorkspace")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
