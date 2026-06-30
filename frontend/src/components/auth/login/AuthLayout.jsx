import AuthCard from "./AuthCard";
import AuthRightPanel from "./AuthRightPanel";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const AuthLayout = () => {
  const { dir, isRTL } = useLocaleDirection();

  return (
    <div className={`flex w-full min-h-screen bg-bg-body ${isRTL ? "lg:flex-row-reverse" : ""}`} dir={dir}>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <AuthCard />
      </div>

      <AuthRightPanel />
    </div>
  );
};

export default AuthLayout;
