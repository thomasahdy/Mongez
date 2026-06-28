import { useState } from "react";
import { FaArrowRight, FaCheck, FaEnvelope, FaSpinner } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthButton from "../../shared/AuthButton";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import AuthInput from "../../shared/AuthInput";
import PasswordInput from "../../shared/PasswordInput";
import SocialAuthButtons from "../../shared/SocialAuthButtons";
import { useLocaleDirection } from "../../../../hooks/useLocaleDirection";

const AccountStep = ({ values, onChange, onNext }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading] = useState(false);
  const passwordRuleLabels = t("registerUi.account.passwordRules", { returnObjects: true });

  const passwordRequirements = [
    { id: "length", label: passwordRuleLabels[0], test: (password) => password.length >= 8 },
    { id: "lowercase", label: passwordRuleLabels[1], test: (password) => /[a-z]/.test(password) },
    { id: "uppercase", label: passwordRuleLabels[2], test: (password) => /[A-Z]/.test(password) },
    { id: "number", label: passwordRuleLabels[3], test: (password) => /\d/.test(password) },
  ];

  const getPasswordStrength = () => {
    const passed = passwordRequirements.filter((rule) => rule.test(values.password)).length;
    if (passed <= 1) return { color: "bg-border", width: "20%" };
    if (passed === 2) return { color: "bg-danger", width: "40%" };
    if (passed === 3) return { color: "bg-[#f59e0b]", width: "60%" };
    return { color: "bg-success", width: "100%" };
  };

  const validate = () => {
    const nextErrors = {};

    if (!values.firstName.trim()) {
      nextErrors.firstName = t("registerUi.account.validations.firstNameRequired");
    } else if (values.firstName.trim().length < 2) {
      nextErrors.firstName = t("registerUi.account.validations.firstNameShort");
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = t("registerUi.account.validations.lastNameRequired");
    } else if (values.lastName.trim().length < 2) {
      nextErrors.lastName = t("registerUi.account.validations.lastNameShort");
    }

    if (!values.email.trim()) {
      nextErrors.email = t("registerUi.account.validations.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      nextErrors.email = t("registerUi.account.validations.emailInvalid");
    }

    if (!values.password) {
      nextErrors.password = t("registerUi.account.validations.passwordRequired");
    } else {
      const failed = passwordRequirements.filter((rule) => !rule.test(values.password));
      if (failed.length > 0) {
        nextErrors.password = t("registerUi.account.validations.passwordMissing", {
          items: failed.map((rule) => rule.label).join(", "),
        });
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    validate();
  };

  const handleContinue = () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
    });

    setErrors((previous) => ({ ...previous, submit: "" }));

    if (!validate()) return;

    onNext();
  };

  const strength = getPasswordStrength();

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-1 text-center text-[22px] font-extrabold tracking-[-0.5px] text-text-primary">
        {t("registerUi.account.title")}
      </h1>

      <p className="mb-7 text-center text-[13px] text-text-secondary">
        {t("registerUi.account.description")}
      </p>

      <SocialAuthButtons providers={["google", "microsoft"]} />

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] font-medium text-text-tertiary">{t("registerUi.account.orEmail")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 min-[580px]:grid-cols-2">
          <AuthInput
            label={t("registerUi.account.firstName")}
            value={values.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            onBlur={() => handleBlur("firstName")}
            error={touched.firstName ? errors.firstName : ""}
            success={touched.firstName && !errors.firstName && Boolean(values.firstName)}
            placeholder={t("registerUi.account.firstNamePlaceholder")}
          />
          <AuthInput
            label={t("registerUi.account.lastName")}
            value={values.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            onBlur={() => handleBlur("lastName")}
            error={touched.lastName ? errors.lastName : ""}
            success={touched.lastName && !errors.lastName && Boolean(values.lastName)}
            placeholder={t("registerUi.account.lastNamePlaceholder")}
          />
        </div>

        <AuthInput
          label={t("registerUi.account.workEmail")}
          type="email"
          value={values.email}
          onChange={(event) => onChange("email", event.target.value)}
          onBlur={() => handleBlur("email")}
          icon={FaEnvelope}
          error={touched.email ? errors.email : ""}
          success={touched.email && !errors.email && Boolean(values.email)}
          placeholder={t("authUi.emailPlaceholder")}
        />

        <div>
          <PasswordInput
            value={values.password}
            onChange={(event) => onChange("password", event.target.value)}
            onBlur={() => handleBlur("password")}
            error={touched.password ? errors.password : ""}
            success={touched.password && !errors.password && Boolean(values.password)}
            placeholder={t("registerUi.account.passwordPlaceholder")}
          />
          <div className="mt-2 h-[3px] overflow-hidden rounded-[2px] bg-border">
            <div className={`h-full rounded-[2px] transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {passwordRequirements.map((requirement) => {
              const passed = requirement.test(values.password);
              return (
                <div
                  key={requirement.id}
                  className={`flex items-center gap-1.5 text-[11px] ${passed ? "text-success" : "text-text-tertiary"} ${
                    isRTL ? "flex-row-reverse justify-end text-right" : ""
                  }`}
                >
                  <FaCheck className={`text-[9px] ${passed ? "opacity-100" : "opacity-0"}`} />
                  {requirement.label}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs leading-[1.6] text-text-secondary">
          {t("registerUi.account.termsPrefix")}{" "}
          <a className="text-primary hover:underline" href="#">
            {t("registerUi.account.terms")}
          </a>{" "}
          {isRTL ? "و" : "and"}{" "}
          <a className="text-primary hover:underline" href="#">
            {t("registerUi.account.privacy")}
          </a>
          .
        </p>

        <AuthErrorMessage>{errors.submit}</AuthErrorMessage>

        <AuthButton onClick={handleContinue} disabled={isLoading} className={isRTL ? "flex-row-reverse" : ""}>
          {isLoading ? (
            <>
              <FaSpinner className="animate-spin text-[10px]" />
              {t("registerUi.account.creating")}
            </>
          ) : isRTL ? (
            <>
              {t("registerUi.account.continue")}
              <FaArrowRight className="rotate-180 text-[10px]" />
            </>
          ) : (
            <>
              <FaArrowRight className="text-[10px]" />
              {t("registerUi.account.continue")}
            </>
          )}
        </AuthButton>
      </div>
    </div>
  );
};

export default AccountStep;
