import { useState } from "react";
import AuthButton from "../../shared/AuthButton";
import AuthInput from "../../shared/AuthInput";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import PasswordInput from "../../shared/PasswordInput";
import SocialAuthButtons from "../../shared/SocialAuthButtons";
import { FaArrowRight, FaEnvelope } from "react-icons/fa";
import { FaCheck, FaSpinner } from "react-icons/fa";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";


const AccountStep = ({ values, onChange, onNext }) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { id: "length", label: "8+ characters", test: (p) => p.length >= 8 },
    { id: "lowercase", label: "1 lowercase", test: (p) => /[a-z]/.test(p) },
    { id: "uppercase", label: "1 uppercase", test: (p) => /[A-Z]/.test(p) },
    { id: "number", label: "1 number", test: (p) => /\d/.test(p) },
  ];

  const getPasswordStrength = () => {
    const passed = passwordRequirements.filter((r) => r.test(values.password)).length;
    if (passed <= 1) return { level: 0, color: "bg-border", width: "20%" };
    if (passed === 2) return { level: 1, color: "bg-danger", width: "40%" };
    if (passed === 3) return { level: 2, color: "bg-[#f59e0b]", width: "60%" };
    return { level: 3, color: "bg-success", width: "100%" };
  };

  const validate = () => {
    const nextErrors = {};

<<<<<<< HEAD
    if (!values.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!values.lastName.trim()) nextErrors.lastName = "Last name is required";
=======
    if (!values.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    } else if (values.firstName.trim().length < 2) {
      nextErrors.firstName = "First name must be at least 2 characters";
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = "Last name is required";
    } else if (values.lastName.trim().length < 2) {
      nextErrors.lastName = "Last name must be at least 2 characters";
    }
>>>>>>> feature/backen_latest

    if (!values.email.trim()) {
      nextErrors.email = "Work email is required";
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      nextErrors.email = "Email is invalid";
    }

    if (!values.password) {
      nextErrors.password = "Password is required";
<<<<<<< HEAD
    } else if (values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(values.password)) {
      nextErrors.password = "Use uppercase, lowercase, and a number";
=======
    } else {
      const failed = passwordRequirements.filter((r) => !r.test(values.password));
      if (failed.length > 0) {
        nextErrors.password = `Password missing: ${failed.map((f) => f.label).join(", ")}`;
      }
>>>>>>> feature/backen_latest
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    validate();
  };

  const handleContinue = async () => {
    setTouched({ firstName: true, lastName: true, email: true, password: true });
<<<<<<< HEAD
    if (validate()) onNext();
  };
=======
    setErrors((prev) => ({ ...prev, submit: '' }));

    if (!validate()) {
      return;
    }
>>>>>>> feature/backen_latest

    setIsLoading(true);

    try {
<<<<<<< HEAD
      if (provider === "google") {
        window.location.href = `${BASE_URL}/auth/google`;
        return;
      }

      throw new Error(`Unsupported social provider: ${provider}`);
    } catch (error) {
      setSocialError(error?.message || `Failed to sign up with ${provider}`);
=======
      const payload = {
        email: values.email,
        password: values.password,
        name: `${values.firstName} ${values.lastName}`,
      };

      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Registration failed. Please try again.");
      }

      onNext();
    } catch (error) {
      setErrors((prev) => ({ ...prev, submit: error.message || "Something went wrong during registration" }));
>>>>>>> feature/backen_latest
    } finally {
      setIsLoading(false);
    }
  };

<<<<<<< HEAD

  // Simple password strength (0–4)
  const strengthScore = (() => {
    const p = values.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthColor = ["bg-border", "bg-red-400", "bg-amber-400", "bg-lime-400", "bg-green-500"][strengthScore];
  const strengthWidth = ["w-0", "w-1/4", "w-2/4", "w-3/4", "w-full"][strengthScore];
=======
  const strength = getPasswordStrength();
>>>>>>> feature/backen_latest

  return (
    <div className="animate-fadeIn">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1 text-center">
        Create your account
      </h1>

<<<<<<< HEAD
      <p className="text-[13px] text-text-secondary mb-5">
        Start your 14-day free trial. No credit card required.
      </p>

      <SocialAuthButtons
        providers={["google"]}
        layout="row"
        loadingProvider={socialLoading}
        onProviderClick={handleSocialSignup}
      />

      <AuthErrorMessage className="mt-3">{socialError}</AuthErrorMessage>

      <AuthDivider className="my-4">or sign up with email</AuthDivider>
=======
      <p className="text-[13px] text-text-secondary mb-7 text-center">
        Start your 14-day free trial. No credit card required.
      </p>

      <SocialAuthButtons providers={["google", "microsoft"]} />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[12px] text-text-tertiary font-medium">or sign up with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>
>>>>>>> feature/backen_latest

      <div className="space-y-3.5">
        <div className="grid grid-cols-1 min-[580px]:grid-cols-2 gap-3">
          <AuthInput
            label="First name"
            value={values.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            onBlur={() => handleBlur("firstName")}
            error={touched.firstName ? errors.firstName : ""}
            success={touched.firstName && !errors.firstName && Boolean(values.firstName)}
            placeholder="Thomas"
          />
          <AuthInput
            label="Last name"
            value={values.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            onBlur={() => handleBlur("lastName")}
            error={touched.lastName ? errors.lastName : ""}
            success={touched.lastName && !errors.lastName && Boolean(values.lastName)}
            placeholder="Ahmed"
          />
        </div>

        <AuthInput
          label="Work email"
          type="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          onBlur={() => handleBlur("email")}
          icon={FaEnvelope}
          error={touched.email ? errors.email : ""}
          success={touched.email && !errors.email && Boolean(values.email)}
          placeholder="you@organization.com"
        />

        <div>
          <PasswordInput
            value={values.password}
            onChange={(e) => onChange("password", e.target.value)}
            onBlur={() => handleBlur("password")}
            error={touched.password ? errors.password : ""}
            success={touched.password && !errors.password && Boolean(values.password)}
            placeholder="Create a strong password"
          />
<<<<<<< HEAD
          <div className="h-[3px] bg-border rounded-sm mt-2 overflow-hidden">
            <div className={`h-full ${strengthWidth} ${strengthColor} rounded-sm transition-all duration-300`} />
          </div>
          <div className="text-[11px] text-text-tertiary mt-0.5">
            Use 8+ characters with uppercase, lowercase, and a number
=======
          <div className="h-[3px] bg-border rounded-[2px] mt-2 overflow-hidden">
            <div className={`h-full ${strength.color} rounded-[2px] transition-all duration-300`} style={{ width: strength.width }} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {passwordRequirements.map((req) => {
              const passed = req.test(values.password);
              return (
                <div key={req.id} className={`flex items-center gap-1.5 text-[11px] ${passed ? "text-success" : "text-text-tertiary"}`}>
                  <FaCheck className={`text-[9px] ${passed ? "opacity-100" : "opacity-0"}`} />
                  {req.label}
                </div>
              );
            })}
>>>>>>> feature/backen_latest
          </div>
        </div>

        <p className="text-xs text-text-secondary leading-[1.6] text-center">
          By signing up, you agree to our{" "}
          <a className="text-primary hover:underline" href="#">Terms of Service</a>{" "}
          and{" "}
          <a className="text-primary hover:underline" href="#">Privacy Policy</a>.
        </p>

        <AuthErrorMessage>{errors.submit}</AuthErrorMessage>

        <AuthButton onClick={handleContinue} disabled={isLoading}>
          {isLoading ? (
            <>
              <FaSpinner className="animate-spin text-[10px]" /> Creating account...
            </>
          ) : (
            <>
              <FaArrowRight className="text-[10px]" /> Continue
            </>
          )}
        </AuthButton>
      </div>
    </div>
  );
};

export default AccountStep;