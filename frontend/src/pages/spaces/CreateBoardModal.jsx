import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createBoardSchema } from "../../schemas/validationSchemas";
import FormModalShell, { ModalActionRow } from "../../components/ui/FormModalShell";

const CreateBoardModal = ({ dept, onSubmit, onClose }) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      name: "",
      description: "",
      departmentId: dept?.id || "",
      type: "KANBAN",
    },
  });

  useEffect(() => {
    if (dept?.id) {
      setValue("departmentId", dept.id);
    }
  }, [dept?.id, setValue]);

  const handleFormSubmit = async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  };

  const handleInvalidSubmit = (validationErrors) => {
    console.warn("CreateBoardModal validation FAILED:", validationErrors);
  };

  return (
    <FormModalShell
      title={t("spacesPage.createBoardIn", { department: dept?.name })}
      closeLabel={t("spacesPage.closeDialog")}
      onClose={onClose}
    >
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="board-name">
              {t("spacesPage.boardName")}
            </label>
            <input
              id="board-name"
              type="text"
              placeholder={t("spacesPage.boardNamePlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.name ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("name")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="board-description">
              {t("spacesPage.description")}
            </label>
            <input
              id="board-description"
              type="text"
              placeholder={t("spacesPage.boardDescriptionPlaceholder")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.description ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
              {...register("description")}
            />
          </div>

          <input type="hidden" {...register("departmentId")} />

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="board-type">
              {t("spacesPage.boardType")}
            </label>
            <select
              id="board-type"
              {...register("type")}
              className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 ${
                errors.type ? "border-red-500 dark:border-red-900/50" : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <option value="KANBAN">{t("spacesPage.boardTypes.kanban")}</option>
              <option value="LIST">{t("spacesPage.boardTypes.list")}</option>
              <option value="TABLE">{t("spacesPage.boardTypes.table")}</option>
              <option value="TIMELINE">{t("spacesPage.boardTypes.timeline")}</option>
              <option value="CALENDAR">{t("spacesPage.boardTypes.calendar")}</option>
              <option value="WHITEBOARD">{t("spacesPage.boardTypes.whiteboard")}</option>
            </select>
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
              {isSubmitting ? t("spacesPage.creating") : t("spacesPage.createBoardButton")}
            </button>
          </ModalActionRow>
        </form>
    </FormModalShell>
  );
};

export default CreateBoardModal;
