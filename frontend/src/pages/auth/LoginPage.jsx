import AuthLayout from "../../components/auth/login/AuthLayout";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const LoginPage = () => {
  const { dir } = useLocaleDirection();

  return (
    <main className="animate-fadeIn" dir={dir}>
      <AuthLayout />
    </main>
  );
};

export default LoginPage;
