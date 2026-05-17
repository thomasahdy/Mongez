import AuthDivider from "../../shared/AuthDivider";
import AuthButton from "../../shared/AuthButton";
import AuthInput from "../../shared/AuthInput";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import PasswordInput from "../../shared/PasswordInput";
import SocialAuthButtons from "../../shared/SocialAuthButtons";
import { FaArrowRight, FaEnvelope } from "react-icons/fa";
import { useState } from "react";

const AccountStep = ({ values, onChange, onNext }) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [socialLoading, setSocialLoading] = useState(null);
  const [socialError, setSocialError] = useState("");

  const validate = () => {
    const nextErrors = {};

    if (!values.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = "Last name is required";
    }

    if (!values.email.trim()) {
      nextErrors.email = "Work email is required";
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      nextErrors.email = "Email is invalid";
    }

    if (!values.password) {
      nextErrors.password = "Password is required";
    } else if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    validate();
  };

  const handleContinue = () => {
    setTouched({ firstName: true, lastName: true, email: true, password: true });

    if (validate()) {
      onNext();
    }
  };

  const handleSocialSignup = async (provider) => {
    setSocialLoading(provider);
    setSocialError("");

    try {
      const response = await fetch(`/api/auth/social-register/${provider}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`${provider} signup failed`);
      }

      const data = await response.json();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      setSocialError(error.message || `Failed to sign up with ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1">
        Create your account
      </h1>

      <p className="text-[13px] text-text-secondary mb-7">
        Start your 14-day free trial. No credit card required.
      </p>

      <SocialAuthButtons
        providers={["google", "microsoft"]}
        layout="row"
        loadingProvider={socialLoading}
        onProviderClick={handleSocialSignup}
      />

      <AuthErrorMessage className="mt-3">{socialError}</AuthErrorMessage>

      <AuthDivider className="my-5">or sign up with email</AuthDivider>

      <div className="space-y-[18px]">
        <div className="grid grid-cols-1 min-[580px]:grid-cols-2 gap-3">
          <AuthInput
            label="First name"
            value={values.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
            onBlur={() => handleBlur("firstName")}
            error={touched.firstName ? errors.firstName : ""}
            placeholder="Thomas"
          />
          <AuthInput
            label="Last name"
            value={values.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
            onBlur={() => handleBlur("lastName")}
            error={touched.lastName ? errors.lastName : ""}
            placeholder="Ahmed"
          />
        </div>

        <AuthInput
          label="Work email"
          type="email"
          value={values.email}
          onChange={(event) => onChange("email", event.target.value)}
          onBlur={() => handleBlur("email")}
          icon={FaEnvelope}
          error={touched.email ? errors.email : ""}
          success={touched.email && !errors.email && Boolean(values.email)}
          placeholder="you@organization.com"
        />

        <div>
          <PasswordInput
            value={values.password}
            onChange={(event) => onChange("password", event.target.value)}
            onBlur={() => handleBlur("password")}
            error={touched.password ? errors.password : ""}
            success={touched.password && !errors.password && Boolean(values.password)}
            placeholder="Create a strong password"
          />
          <div className="h-[3px] bg-border rounded-sm mt-2 overflow-hidden">
            <div className="h-full w-3/5 bg-[#f59e0b] rounded-sm transition-all" />
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            Use 8+ characters with a mix of letters, numbers & symbols
          </div>
        </div>

        <p className="text-xs text-text-secondary leading-[1.6]">
          By signing up, you agree to our{" "}
          <a className="text-primary hover:underline" href="#">
            Terms of Service
          </a>{" "}
          and{" "}
          <a className="text-primary hover:underline" href="#">
            Privacy Policy
          </a>
          .
        </p>

        <AuthButton onClick={handleContinue}>
          Continue <FaArrowRight className="text-xs" />
        </AuthButton>
      </div>
    </div>
  );
};

export default AccountStep;
