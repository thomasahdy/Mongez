import AuthCard from "./AuthCard";
import AuthRightPanel from "./AuthRightPanel";

const AuthLayout = () => {
  return (
    <div className="flex w-full min-h-screen bg-bg-body">
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <AuthCard />
      </div>

      <AuthRightPanel />
    </div>
  );
};

export default AuthLayout;