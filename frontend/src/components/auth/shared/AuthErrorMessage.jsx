import { FaExclamationCircle } from "react-icons/fa";

const AuthErrorMessage = ({ children, compact = false, className = "" }) => {
  const errorMessage = typeof children === "string" ? children : String(children || "");

  if (!errorMessage) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-[12px] text-danger mt-1.5 animate-slideDown ${className}`}>
        <FaExclamationCircle className="text-[10px] flex-shrink-0" />
        <span>{errorMessage}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-[13px] text-danger bg-danger/10 p-3 rounded-lg border border-danger/20 animate-slideDown ${className}`}>
      <FaExclamationCircle className="flex-shrink-0 text-[14px]" />
      <span>{errorMessage}</span>
    </div>
  );
};

export default AuthErrorMessage;