const AuthDivider = ({ children = "or continue with", className = "" }) => {
  return (
    <div className={`flex items-center gap-3 my-6 text-[12px] text-text-tertiary ${className}`}>
      <div className="flex-1 h-px bg-border" />
      <span className="font-medium">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

export default AuthDivider;