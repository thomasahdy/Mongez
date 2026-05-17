import { FaGoogle, FaMicrosoft, FaWhatsapp } from "react-icons/fa";

const providerConfig = {
  google: {
    label: "Google",
    icon: FaGoogle,
    iconColor: "#4285f4",
    hoverClass: "hover:bg-[#fafbfc] hover:border-text-tertiary",
  },
  microsoft: {
    label: "Microsoft",
    icon: FaMicrosoft,
    iconColor: "#00a4ef",
    hoverClass: "hover:bg-[#fafbfc] hover:border-text-tertiary",
  },
  whatsapp: {
    label: "WhatsApp OTP",
    icon: FaWhatsapp,
    iconColor: "#25D366",
    hoverClass: "hover:bg-[#f0fff4] hover:border-[#25D366] hover:text-[#128C7E]",
  },
};

const SocialAuthButtons = ({
  providers = ["google", "microsoft", "whatsapp"],
  layout = "column",
  loadingProvider = null,
  onProviderClick,
}) => {
  const wrapperClass = layout === "row" ? "flex gap-2.5" : "space-y-3";

  return (
    <div className={wrapperClass}>
      {providers.map((provider) => {
        const config = providerConfig[provider];
        const Icon = config.icon;
        const loading = loadingProvider === provider;

        return (
          <button
            key={provider}
            type="button"
            onClick={() => onProviderClick?.(provider)}
            disabled={loadingProvider !== null}
            className={`w-full flex items-center justify-center gap-2.5 py-[11px] px-4 border-[1.5px] border-border rounded bg-white text-text-primary font-medium text-[13px] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px ${config.hoverClass}`}
            aria-label={`Continue with ${config.label}`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
            ) : (
              <Icon style={{ color: config.iconColor }} />
            )}
            {config.label}
          </button>
        );
      })}
    </div>
  );
};

export default SocialAuthButtons;
