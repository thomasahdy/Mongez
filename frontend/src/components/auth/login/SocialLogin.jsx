import SocialAuthButtons from "../shared/SocialAuthButtons";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const SocialLogin = () => {
  return (
    <div className="space-y-3">
      <SocialAuthButtons providers={["google", "microsoft"]} />
    </div>
  );
};

export default SocialLogin;