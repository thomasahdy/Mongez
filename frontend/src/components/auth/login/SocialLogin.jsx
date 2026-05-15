import { useState } from "react";
import AuthErrorMessage from "../shared/AuthErrorMessage";
import SocialAuthButtons from "../shared/SocialAuthButtons";

const SocialLogin = () => {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleSocialLogin = async (provider) => {
    setLoading(provider);
    setError(null);

    try {
      const response = await fetch(`/api/auth/social-login/${provider}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`${provider} login failed`);
      }

      const data = await response.json();

      // Redirect to OAuth provider URL if provided
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      setError(err.message || `Failed to login with ${provider}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <AuthErrorMessage>{error}</AuthErrorMessage>
      <SocialAuthButtons loadingProvider={loading} onProviderClick={handleSocialLogin} />
    </div>
  );
};

export default SocialLogin;
