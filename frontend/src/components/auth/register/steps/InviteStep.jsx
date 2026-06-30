import { FaArrowLeft, FaPlus, FaRocket, FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthButton from "../../shared/AuthButton";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import AuthInput from "../../shared/AuthInput";
import { useLocaleDirection } from "../../../../hooks/useLocaleDirection";

const roleValues = ["MEMBER", "ADMIN", "VIEWER"];

const InviteStep = ({ invites, onChange, onBack, onSubmit, loading, submitError, onSkip }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const roleLabels = t("registerUi.invite.roles", { returnObjects: true });

  const addInvite = () => {
    onChange([...invites, { email: "", role: roleValues[0] }]);
  };

  const removeInvite = (index) => {
    onChange(invites.filter((_, inviteIndex) => inviteIndex !== index));
  };

  const updateInvite = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    onChange(updated);
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-1 text-center text-[22px] font-extrabold tracking-[-0.5px] text-text-primary">
        {t("registerUi.invite.title")}
      </h1>

      <p className="mb-7 text-center text-[13px] text-text-secondary">
        {t("registerUi.invite.description")}
      </p>

      <div className="mb-4 space-y-2.5">
        {invites.map((invite, index) => (
          <div key={index} className={`flex items-end gap-2.5 animate-slideIn ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="min-w-0 flex-1">
              <AuthInput
                label={index === 0 ? t("registerUi.invite.email") : ""}
                type="email"
                placeholder={t("registerUi.invite.emailPlaceholder")}
                value={invite.email}
                onChange={(event) => updateInvite(index, "email", event.target.value)}
              />
            </div>

            <div className="w-[120px] flex-shrink-0">
              {index === 0 && (
                <label className="mb-1.5 block text-[13px] font-semibold text-text-primary text-start">
                  {t("registerUi.invite.role")}
                </label>
              )}
              <select
                value={invite.role}
                onChange={(event) => updateInvite(index, "role", event.target.value)}
                className="w-full cursor-pointer rounded-lg border-[1.5px] border-border bg-white px-3.5 py-[11px] text-[13px] text-start transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                {roleValues.map((role, index) => (
                  <option key={role} value={role}>
                    {roleLabels[index] || role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeInvite(index)}
              className="mb-px flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-[1.5px] border-border bg-white text-text-tertiary transition-all duration-200 hover:scale-105 hover:border-danger hover:bg-[#fef2f2] hover:text-danger"
              aria-label={t("registerUi.invite.removeInvite")}
            >
              <FaTimes className="text-[10px]" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addInvite}
        className={`mt-1 flex w-full items-center justify-center gap-1.5 border-0 bg-transparent py-2 text-[13px] font-medium text-primary hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
      >
        <FaPlus className="text-[10px]" />
        {t("registerUi.invite.addAnother")}
      </button>

      <AuthErrorMessage className="mb-4 mt-3">{submitError}</AuthErrorMessage>

      <div className={`mb-3 flex gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <AuthButton variant="outline" onClick={onBack} className={isRTL ? "flex-row-reverse" : ""}>
          {isRTL ? (
            <>
              {t("registerUi.invite.back")}
              <FaArrowLeft className="rotate-180 text-[10px]" />
            </>
          ) : (
            <>
              <FaArrowLeft className="text-[10px]" />
              {t("registerUi.invite.back")}
            </>
          )}
        </AuthButton>

        <AuthButton
          loading={loading}
          loadingLabel={t("registerUi.invite.launching")}
          onClick={() => onSubmit()}
          className={isRTL ? "flex-row-reverse" : ""}
        >
          {isRTL ? (
            <>
              {t("registerUi.invite.launchWorkspace")}
              <FaRocket className="text-[10px]" />
            </>
          ) : (
            <>
              <FaRocket className="text-[10px]" />
              {t("registerUi.invite.launchWorkspace")}
            </>
          )}
        </AuthButton>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="w-full cursor-pointer rounded-lg border-0 bg-transparent py-3 text-[13px] text-text-tertiary transition-all duration-200 hover:bg-bg-body hover:text-text-secondary"
      >
        {t("registerUi.invite.skip")}
      </button>
    </div>
  );
};

export default InviteStep;