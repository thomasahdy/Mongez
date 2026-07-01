import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createSpaceSchema } from "../../schemas/validationSchemas";
import FormModalShell, { ModalActionRow } from "../../components/ui/FormModalShell";

export default function CreateSpaceModal({ isEdit = false, space, onSubmit, onClose }) {
  const { t } = useTranslation();
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
    <FormModalShell
      title={isEdit ? t("spacesPage.workspaceSettings") : t("spacesPage.createSpaceTitle")}
      closeLabel={t("spacesPage.closeDialog")}
      onClose={onClose}
    >
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

          <ModalActionRow>
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
          </ModalActionRow>
        </form>
    </FormModalShell>
  );
}
