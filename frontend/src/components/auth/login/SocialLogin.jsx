import SocialAuthButtons from "../shared/SocialAuthButtons";

const SocialLogin = () => {
  return (
    <div className="space-y-3">
      <SocialAuthButtons providers={["google", "microsoft"]} />
    </div>
  );
};

export default SocialLogin;
