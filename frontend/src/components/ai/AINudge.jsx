import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { dismissAiNudge, queueAiLaunchDraft, shouldShowAiNudge, snoozeAiNudgeUntilTomorrow } from "../../lib/aiLauncher";

const AINudge = ({ onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shouldShowAiNudge()) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timeoutId);
  }, []);

  const closeNudge = () => {
    dismissAiNudge();
    setVisible(false);
    onDismiss?.();
  };

  const snoozeNudge = () => {
    snoozeAiNudgeUntilTomorrow();
    setVisible(false);
  };

  const launchAssistant = () => {
    queueAiLaunchDraft({
      prompt: t("aiPreview.nudge.launchPrompt"),
      source: "nudge",
    });
    dismissAiNudge();
    setVisible(false);
    navigate("/ai-assistant");
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-[88px] z-[200] w-[340px] rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl transition-all duration-400 dark:border-slate-700 dark:bg-slate-800 ${isRTL ? "left-6" : "right-6"} ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      role="status"
      aria-live="polite"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`mb-3 flex items-start gap-2.5 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
        <i className="fa-solid fa-robot mt-0.5 text-[16px] text-indigo-500" />
        <p className="flex-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          <strong className="text-slate-800 dark:text-slate-100">{t("aiPreview.nudge.greeting")}</strong>{" "}
          {t("aiPreview.nudge.body")}
        </p>
        <button
          type="button"
          onClick={closeNudge}
          className="text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          aria-label={t("aiPreview.nudge.dismiss")}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <div className={`flex gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
        <button
          type="button"
          onClick={launchAssistant}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-indigo-600"
        >
          {t("aiPreview.nudge.yes")}
        </button>
        <button
          type="button"
          onClick={snoozeNudge}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {t("aiPreview.nudge.tomorrow")}
        </button>
        <button
          type="button"
          onClick={closeNudge}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {t("aiPreview.nudge.notNow")}
        </button>
      </div>
    </div>
  );
};

export default AINudge;
