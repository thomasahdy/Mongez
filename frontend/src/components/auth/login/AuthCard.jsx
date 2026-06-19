import AuthDivider from "../shared/AuthDivider";
import AuthFooterLink from "../shared/AuthFooterLink";
import AuthLogo from "../shared/AuthLogo";
import SocialLogin from "./SocialLogin";
import LoginForm from "./LoginForm";

const AuthCard = () => {
  return (
    <div className="w-full max-w-[400px]">
      <AuthLogo />
      <h1 className="text-[26px] max-[480px]:text-[22px] leading-tight font-extrabold text-text-primary mb-1.5 tracking-[-0.5px] text-center">
        Welcome back
      </h1>

      <p className="text-[13px] text-text-secondary mb-8 text-center">Log in to your Mongez workspace</p>

      <LoginForm />

      <AuthDivider className="my-7" />

      <SocialLogin />

      <AuthFooterLink
        text="Don't have an account?"
        linkText="Sign up free"
        href="/register"
        className="mt-7"
      />
    </div>
  );
};

export default AuthCard;
