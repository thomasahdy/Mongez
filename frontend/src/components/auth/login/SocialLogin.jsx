import { useState } from "react";
import AuthErrorMessage from "../shared/AuthErrorMessage";
import SocialAuthButtons from "../shared/SocialAuthButtons";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const SocialLogin = () => {

  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleSocialLogin = async (provider) => {
    setLoading(provider);
    setError(null);

    try {
      // OAuth must be a browser redirect
      if (provider === "google") {
        window.location.href = `${BASE_URL}/auth/google`;
        return;
      }

      throw new Error(`Unsupported social provider: ${provider}`);
    } catch (err) {
      setError(err?.message || `Failed to login with ${provider}`);
    } finally {
      setLoading(null);
    }

  };

  return (
    <div className="space-y-3">
      <AuthErrorMessage>{error}</AuthErrorMessage>
      <SocialAuthButtons
        providers={["google"]}
        loadingProvider={loading}
        onProviderClick={handleSocialLogin}
      />
    </div>
  );
};

export default SocialLogin;
