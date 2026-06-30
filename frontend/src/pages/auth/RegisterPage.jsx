import RegisterContainer from "../../components/auth/register/RegisterContainer";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const RegisterPage = () => {
  const { dir } = useLocaleDirection();

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-bg-body animate-fadeIn" dir={dir}>
      <RegisterContainer />
    </main>
  );
};

export default RegisterPage;
