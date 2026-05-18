import { useState } from "react";
import { useDispatch } from "react-redux";
import { FaEnvelope, FaSignInAlt } from "react-icons/fa";
import AuthButton from "../shared/AuthButton";
import AuthErrorMessage from "../shared/AuthErrorMessage";
import AuthInput from "../shared/AuthInput";
import PasswordInput from "../shared/PasswordInput";
import { loginUser } from "../../../store/auth/authThunks";


const LoginForm = () => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = (nextValues = { email, password }) => {
    const newErrors = {};

    if (!nextValues.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(nextValues.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!nextValues.password) {
      newErrors.password = "Password is required";
    } else if (nextValues.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (!validate()) return;

    setLoading(true);

    try {
      const result = await dispatch(
        loginUser({ email, password })
      ).unwrap();

      // backend authSlice stores token; now redirect
      window.location.href = result?.redirectTo || "#dashboard";
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || "Something went wrong",
      }));
    } finally {
      setLoading(false);
    }

  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AuthInput
        label="Email address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => handleBlur("email")}
        icon={FaEnvelope}
        error={touched.email ? errors.email : ""}
        success={touched.email && !errors.email && Boolean(email)}
        placeholder="you@organization.com"
      />

      <PasswordInput
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me for 30 days
        </label>
        <a
          href="#forgot-password"
          className="text-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        >
          Forgot password?
        </a>
      </div>

      <AuthErrorMessage>{errors.submit}</AuthErrorMessage>

      <AuthButton type="submit" loading={loading} loadingLabel="Logging in...">
        <FaSignInAlt className="text-sm" />
        Log In
      </AuthButton>
    </form>
  );
};

export default LoginForm;
