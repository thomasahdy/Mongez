import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { inviteMemberSchema } from "../../schemas/validationSchemas";
import FormModalShell, { ModalActionRow } from "../../components/ui/FormModalShell";

const InviteMemberModal = ({ space, onSubmit, onClose }) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
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
    } catch (error) {
      console.error("Form submission failed:", error);
    }
  };

  const handleInvalidSubmit = (validationErrors) => {
    console.warn("InviteMemberModal handleSubmit validation FAILED:", validationErrors);
  };

  return (
    <FormModalShell
      title={t("spacesPage.inviteMemberTo", { space: space?.name })}
      closeLabel={t("spacesPage.closeDialog")}
      onClose={onClose}
    >
        <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="invite-email">
              {t("spacesPage.memberEmail")}
            </label>
            <input
              id="invite-email"
              type="text"
              placeholder="ahmed@company.com"
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 dark:border-slate-800"
              {...register("email")}
            />
          </div>

          <select
            id="role"
            {...register("role")}
            className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-sky-400 dark:border-slate-800"
          >
            <option value="MEMBER">{t("members.roles.MEMBER")}</option>
            <option value="ADMIN">{t("members.roles.ADMIN")}</option>
            <option value="VIEWER">{t("members.roles.VIEWER")}</option>
          </select>

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
              {isSubmitting ? t("spacesPage.sending") : t("spacesPage.inviteMember")}
            </button>
          </ModalActionRow>
        </form>
    </FormModalShell>
  );
};

export default InviteMemberModal;
