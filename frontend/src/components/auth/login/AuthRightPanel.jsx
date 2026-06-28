import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const AuthRightPanel = () => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <div className="relative hidden w-[480px] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e] px-12 py-16 text-white lg:flex">
      <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-[300px] w-[300px] bg-[radial-gradient(circle,rgba(0,168,232,0.15)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-[-80px] left-[-80px] h-[250px] w-[250px] bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)]" />

      <div className="relative z-10 text-center">
        <h2 className="mb-3 text-[28px] font-extrabold leading-tight tracking-[-0.5px]">
          {t("authUi.rightPanel.titleLineOne")}
          <br />
          {t("authUi.rightPanel.titleLineTwo")}
        </h2>

        <p className="mx-auto mb-8 max-w-xs text-[15px] leading-[1.7] opacity-85">
          {t("authUi.rightPanel.description")}
        </p>

        <div className="mb-8 flex justify-center gap-8">
          <div>
            <div className="text-[28px] font-extrabold leading-none">2.4k+</div>
            <div className="mt-0.5 text-xs opacity-75">{t("authUi.rightPanel.activeTeams")}</div>
          </div>
          <div>
            <div className="text-[28px] font-extrabold leading-none">89%</div>
            <div className="mt-0.5 text-xs opacity-75">{t("authUi.rightPanel.onTimeRate")}</div>
          </div>
          <div>
            <div className="text-[28px] font-extrabold leading-none">4.8★</div>
            <div className="mt-0.5 text-xs opacity-75">{t("authUi.rightPanel.userRating")}</div>
          </div>
        </div>

        <div className={`mt-12 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.08)] p-6 ${isRTL ? "text-right" : "text-left"}`}>
          <p className="mb-4 text-sm leading-[1.7] opacity-90">{t("authUi.rightPanel.quote")}</p>
          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold">
              AH
            </div>
            <div>
              <div className="text-xs font-semibold">{t("authUi.rightPanel.quoteAuthor")}</div>
              <div className="text-xs opacity-60">{t("authUi.rightPanel.quoteRole")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthRightPanel;
