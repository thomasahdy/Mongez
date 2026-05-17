import { FaExclamationCircle } from "react-icons/fa";

const AuthErrorMessage = ({ children, compact = false, className = "" }) => {
  if (!children) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 text-xs text-danger ${className}`}>
        <FaExclamationCircle className="text-xs" />
        {children}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-danger bg-danger/10 p-3 rounded-lg border border-danger/20 ${className}`}>
      <FaExclamationCircle className="flex-shrink-0" />
      {children}
    </div>
  );
};

export default AuthErrorMessage;
