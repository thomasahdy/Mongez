import AuthDivider from "../shared/AuthDivider";
import AuthFooterLink from "../shared/AuthFooterLink";
import AuthLogo from "../shared/AuthLogo";
import SocialLogin from "./SocialLogin";
import LoginForm from "./LoginForm";
import { useTranslation } from "react-i18next";

const AuthCard = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-[400px]">
      <AuthLogo />
      <h1 className="text-[26px] max-[480px]:text-[22px] leading-tight font-extrabold text-text-primary mb-1.5 tracking-[-0.5px] text-center">
        {t("authUi.welcomeBack")}
      </h1>

      <p className="text-[13px] text-text-secondary mb-8 text-center">{t("authUi.loginSubtitle")}</p>

      <LoginForm />

      <AuthDivider className="my-7" />

      <SocialLogin />

      <AuthFooterLink
        text={t("authUi.noAccount")}
        linkText={t("authUi.signUpFree")}
        href="/register"
        className="mt-7"
      />
    </div>
  );
};

export default AuthCard;
