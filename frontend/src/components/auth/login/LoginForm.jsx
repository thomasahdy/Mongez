import { useState } from "react";
import { FaEnvelope, FaSignInAlt } from "react-icons/fa";
import AuthButton from "../shared/AuthButton";
import AuthErrorMessage from "../shared/AuthErrorMessage";
import AuthInput from "../shared/AuthInput";
import PasswordInput from "../shared/PasswordInput";

const LoginForm = () => {
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
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(nextValues.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!nextValues.password) {
      newErrors.password = "Password is required";
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

    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors((prev) => ({ ...prev, submit: "" }));

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || data.error || "Login failed";
        if (response.status === 401) {
          throw new Error("Invalid email or password");
        } else if (response.status === 429) {
          throw new Error("Too many attempts. Please try again later.");
        } else {
          throw new Error(errorMessage);
        }
      }

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login failed", error);
      setErrors((prev) => ({ ...prev, submit: error.message || "Something went wrong" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn">
      <AuthInput
        label="Email address"
        type="email"
        id={emailInputId}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => handleBlur("email")}
        icon={FaEnvelope}
        error={touched.email ? errors.email : ""}
        success={touched.email && !errors.email && Boolean(email)}
        placeholder="you@organization.com"
      />

      <PasswordInput
        id={passwordInputId}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => handleBlur("password")}
        error={touched.password ? errors.password : ""}
        success={touched.password && !errors.password && Boolean(password)}
        placeholder="Enter your password"
      />

      <div className="flex justify-between items-center text-[13px] gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-text-primary hover:text-text-secondary transition">
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary cursor-pointer"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me for 30 days
        </label>
        <a
          href="/forgot-password"
          className="text-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 py-1 transition"
        >
          Forgot password?
        </a>
      </div>

      <AuthErrorMessage>{errors.submit}</AuthErrorMessage>

      <AuthButton type="submit" loading={loading} loadingLabel="Logging in...">
        <FaSignInAlt className="text-[10px]" />
        Log In
      </AuthButton>
    </form>
  );
};

export default LoginForm;