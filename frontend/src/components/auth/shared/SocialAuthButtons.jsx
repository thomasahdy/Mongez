import { FaGoogle, FaMicrosoft, FaWhatsapp } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const providerConfig = {
  google: {
    labelKey: "google",
    icon: FaGoogle,
    iconColor: "#4285f4",
    oauthUrl: "/api/v1/auth/google",
  },
  microsoft: {
    labelKey: "microsoft",
    icon: FaMicrosoft,
    iconColor: "#00a8e8",
    disabled: true,
    oauthUrl: "/api/v1/auth/google", // Use Google for now, add Microsoft later
  },
  whatsapp: {
    labelKey: "whatsapp",
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
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const wrapperClass = layout === "row" ? "flex gap-2.5" : "space-y-3";

  return (
    <div className={wrapperClass}>
      {providers.map((provider) => {
        const config = providerConfig[provider];
        const Icon = config.icon;
        const label = t(`authUi.providers.${config.labelKey}`);

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
            disabled={config.disabled}
            className={`w-full rounded-lg border-[1.5px] border-border bg-white px-4 py-[11px] text-[13px] font-medium text-text-primary transition-all hover:-translate-y-px hover:shadow-sm ${
              isRTL ? "flex flex-row-reverse items-center justify-center gap-2.5" : "flex items-center justify-center gap-2.5"
            }`}
            aria-label={t("authUi.continueWith", { provider: label })}
          >
            <Icon className="text-[18px]" style={{ color: config.iconColor }} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default SocialAuthButtons;
