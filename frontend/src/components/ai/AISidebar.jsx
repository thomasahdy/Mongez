import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { queueAiLaunchDraft } from "../../lib/aiLauncher";

const AISidebar = ({ open, onClose }) => {
  const [inputVal, setInputVal] = useState("");
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const navigate = useNavigate();

  const openAssistant = useCallback(
    (prompt = "") => {
      const trimmedPrompt = String(prompt || "").trim();

      if (trimmedPrompt) {
        queueAiLaunchDraft({ prompt: trimmedPrompt, source: "sidebar" });
      }

      setInputVal("");
      onClose?.();
      navigate("/ai-assistant");
    },
    [navigate, onClose],
  );

  const handleKey = useCallback(
    (event) => {
      if (event.key === "Escape" && open) {
        onClose?.();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const contextItems = useMemo(
    () => [
      t("aiPreview.contextItems.workspace"),
      t("aiPreview.contextItems.board"),
      t("aiPreview.contextItems.followUps"),
    ],
    [t],
  );

  const actions = useMemo(
    () => [
      {
        icon: "fa-solid fa-list-check",
        label: t("aiPreview.actions.summarizeBlockers"),
        prompt: t("aiPreview.prompts.summarizeBlockers"),
      },
      {
        icon: "fa-regular fa-pen-to-square",
        label: t("aiPreview.actions.draftFollowUp"),
        prompt: t("aiPreview.prompts.draftFollowUp"),
      },
      {
        icon: "fa-solid fa-shield-halved",
        label: t("aiPreview.actions.reviewRisks"),
        prompt: t("aiPreview.prompts.reviewRisks"),
      },
    ],
    [t],
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-[999] bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 bottom-0 z-[1000] flex w-[360px] flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-800 ${
          isRTL
            ? `left-0 border-r border-slate-200 dark:border-slate-700 ${open ? "translate-x-0" : "-translate-x-full"}`
            : `right-0 border-l border-slate-200 dark:border-slate-700 ${open ? "translate-x-0" : "translate-x-full"}`
        }`}
        aria-label={t("aiPreview.panelAria")}
        aria-hidden={!open}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className={`flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <i className="fa-solid fa-robot text-indigo-500" />
            <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{t("aiPreview.title")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
            aria-label={t("aiPreview.closePanel")}
          >
            <i className="fa-solid fa-xmark text-[15px]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className={`self-start max-w-[88%] rounded-xl bg-slate-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 dark:bg-slate-700 dark:text-slate-200 ${isRTL ? "rounded-br-sm text-right" : "rounded-bl-sm text-left"}`}>
            {t("aiPreview.message")}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/50">
            <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
              <i className="fa-solid fa-chart-bar text-sky-500" /> {t("aiPreview.context")}
            </p>
            <ul className="space-y-1" aria-label={t("aiPreview.context")}>
              {contextItems.map((item) => (
                <li key={item} className={`flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-300 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
                  <span className="text-lg leading-none text-slate-300" aria-hidden="true">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
              <i className="fa-solid fa-bullseye text-indigo-500" /> {t("aiPreview.suggestedActions")}
            </p>
            {actions.map(({ icon, label, prompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => openAssistant(prompt)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 transition-all duration-150 last:mb-0 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-sky-900/20 ${isRTL ? "flex-row-reverse text-right" : "text-left hover:translate-x-0.5"}`}
              >
                <i className={`${icon} w-4 text-center`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <button
            type="button"
            onClick={() => openAssistant()}
            className="mb-3 flex w-full items-center justify-center rounded-xl border border-slate-200 px-3.5 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t("aiPreview.openAssistant")}
          </button>

          <div className={`flex gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-700 ${isRTL ? "flex-row-reverse" : ""}`}>
            <input
              type="text"
              value={inputVal}
              onChange={(event) => setInputVal(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && inputVal.trim()) {
                  event.preventDefault();
                  openAssistant(inputVal);
                }
              }}
              placeholder={t("aiPreview.inputPlaceholder")}
              className={`flex-1 border-none bg-transparent px-2.5 py-1.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-200 ${isRTL ? "text-right" : "text-left"}`}
              aria-label={t("aiPreview.askAria")}
            />
            <button
              type="button"
              onClick={() => openAssistant(inputVal)}
              disabled={!inputVal.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-[12px] text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={t("aiPreview.sendMessage")}
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AISidebar;
