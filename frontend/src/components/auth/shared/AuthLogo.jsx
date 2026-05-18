const AuthLogo = ({ className = "mb-10" }) => {
  return (
    <a href="#landing" className={`inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1 ${className}`}
    >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#00a8e8" />
            <path d="M8 22V10l5 8 5-8v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="24" cy="10" r="2" fill="#6366f1" />
        </svg>
        
        <span className="text-[22px] leading-none font-extrabold tracking-[-0.5px] text-text-primary">Mongez</span>
    </a>
  );
};

export default AuthLogo;
