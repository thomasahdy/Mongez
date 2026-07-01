import { createDepartmentSchema } from "../../schemas/validationSchemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import FormModalShell, { ModalActionRow } from "../../components/ui/FormModalShell";

const CreateDepartmentModal = ({ space, onSubmit, onClose }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "",
    },
  });

  const handleFormSubmit = async (data) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  };

  const handleInvalidSubmit = (validationErrors) => {
    console.warn("CreateDepartmentModal handleSubmit validation FAILED:", validationErrors);
  };

  return (
    <FormModalShell
      title={t("spacesPage.createDepartmentIn", { space: space?.name })}
      closeLabel={t("spacesPage.closeDialog")}
      onClose={onClose}
    >
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="department-name">
              {t("spacesPage.departmentName")}
            </label>
            <input
              id="department-name"
              type="text"
              placeholder={t("spacesPage.departmentNamePlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.name ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("name")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="department-description">
              {t("spacesPage.description")}
            </label>
            <input
              id="department-description"
              type="text"
              placeholder={t("spacesPage.departmentDescriptionPlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.description ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("description")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="department-color">
              {t("spacesPage.departmentColor")}
            </label>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <input
                id="department-color"
                type="color"
                className={`h-10 w-12 cursor-pointer rounded-xl border bg-transparent outline-none transition-all ${
                  errors.color ? "border-red-500" : "border-slate-200 dark:border-slate-800"
                }`}
                {...register("color")}
              />
              <span className="text-sm text-slate-500">{t("spacesPage.departmentColorHint")}</span>
            </div>
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
              {isSubmitting ? t("spacesPage.creating") : t("spacesPage.createDepartmentButton")}
            </button>
          </ModalActionRow>
        </form>
    </FormModalShell>
  );
};

export default CreateDepartmentModal;
