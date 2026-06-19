const RegisterCard = ({ children }) => {
  return (
    <div className="bg-white border border-border rounded-[12px] p-9 shadow-sm animate-cardFadeIn">
      {children}
    </div>
  );
};

export default RegisterCard;
