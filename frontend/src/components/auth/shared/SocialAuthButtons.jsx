import { FaGoogle, FaMicrosoft, FaWhatsapp } from "react-icons/fa";

const providerConfig = {
  google: {
    label: "Google",
    icon: FaGoogle,
    iconColor: "#4285f4",
    oauthUrl: "/api/v1/auth/google",
  },
  microsoft: {
    label: "Microsoft",
    icon: FaMicrosoft,
    iconColor: "#00a4ef",
    oauthUrl: "/api/v1/auth/google", // Use Google for now, add Microsoft later
  },
  whatsapp: {
    label: "WhatsApp OTP",
    icon: FaWhatsapp,
    iconColor: "#25D366",
    action: "otp", // Different flow for OTP
  },
};

const SocialAuthButtons = ({
  providers = ["google", "microsoft", "whatsapp"],
  layout = "column",
  onProviderClick,
}) => {
  const wrapperClass = layout === "row" ? "flex gap-2.5" : "space-y-3";

  return (
    <div className={wrapperClass}>
      {providers.map((provider) => {
        const config = providerConfig[provider];
        const Icon = config.icon;

        const handleClick = () => {
          if (config.oauthUrl) {
            window.location.href = config.oauthUrl;
          } else {
            onProviderClick?.(provider);
          }
        };

        return (
          <button
            key={provider}
            type="button"
            onClick={handleClick}
            className="w-full flex items-center justify-center gap-2.5 py-[11px] px-4 border-[1.5px] border-border rounded-lg bg-white text-text-primary font-medium text-[13px] transition-all hover:-translate-y-px hover:shadow-sm"
            aria-label={`Continue with ${config.label}`}
          >
            <Icon className="text-[18px]" style={{ color: config.iconColor }} />
            {config.label}
          </button>
        );
      })}
    </div>
  );
};

export default SocialAuthButtons;
