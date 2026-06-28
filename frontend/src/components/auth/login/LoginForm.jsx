import { useState } from "react";
import { FaEnvelope, FaSignInAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthButton from "../shared/AuthButton";
import AuthErrorMessage from "../shared/AuthErrorMessage";
import AuthInput from "../shared/AuthInput";
import PasswordInput from "../shared/PasswordInput";
import authService from "../../../services/api/authService";
import { NavLink } from "react-router";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";


const LoginForm = () => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const emailInputId = "email-input";
  const passwordInputId = "password-input";

  const validate = (nextValues = { email, password }) => {
    const newErrors = {};

    if (!nextValues.email.trim()) {
      newErrors.email = t("authUi.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(nextValues.email)) {
      newErrors.email = t("authUi.emailInvalid");
    }

    if (!nextValues.password) {
      newErrors.password = t("authUi.passwordRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validate();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (!validate()) return;

    setLoading(true);
    setErrors((prev) => ({ ...prev, submit: "" }));

    try {
      await authService.login({ email, password });
      window.location.href = "/spaces";
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || t("authUi.somethingWentWrong"),
      }));
    } finally {
      setLoading(false);
    }

  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn">
      <AuthInput
        label={t("authUi.emailAddress")}
        type="email"
        id={emailInputId}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => handleBlur("email")}
        icon={FaEnvelope}
        error={touched.email ? errors.email : ""}
        success={touched.email && !errors.email && Boolean(email)}
        placeholder={t("authUi.emailPlaceholder")}
      />

      <PasswordInput
        id={passwordInputId}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onBlur={() => handleBlur("password")}
        error={touched.password ? errors.password : ""}
        success={touched.password && !errors.password && Boolean(password)}
        placeholder={t("authUi.passwordPlaceholder")}
      />

      <div className={`flex items-center justify-between gap-3 text-[13px] ${isRTL ? "flex-row-reverse" : ""}`}>
        <label
          className={`flex cursor-pointer items-center gap-2 text-text-primary transition hover:text-text-secondary ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary cursor-pointer"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          {t("authUi.rememberMe")}
        </label>
        <NavLink
          to="/forgot-password"
          className="rounded-lg px-2 py-1 text-primary font-medium transition hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {t("authUi.forgotPassword")}
        </NavLink>
      </div>

      <AuthErrorMessage>{errors.submit}</AuthErrorMessage>

      <AuthButton
        type="submit"
        loading={loading}
        loadingLabel={t("authUi.loggingIn")}
        className={isRTL ? "flex-row-reverse" : ""}
      >
        {isRTL ? (
          <>
            {t("authUi.logIn")}
            <FaSignInAlt className="text-[10px]" />
          </>
        ) : (
          <>
            <FaSignInAlt className="text-[10px]" />
            {t("authUi.logIn")}
          </>
        )}
      </AuthButton>
    </form>
  );
};

export default LoginForm;
