import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const TOOLTIP_WIDTH = 320;
const VIEWPORT_PADDING = 20;
const TOOLTIP_ESTIMATED_HEIGHT = 220;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function PostOnboardingWalkthrough({ open, onClose }) {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [availableSteps, setAvailableSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [stepsResolved, setStepsResolved] = useState(false);

  const stepDefinitions = useMemo(
    () => [
      {
        id: "workspaceSwitcher",
        selector: '[data-tour="workspace-switcher"]',
        title: t("layout.walkthrough.steps.workspaceSwitcher.title"),
        description: t("layout.walkthrough.steps.workspaceSwitcher.description"),
      },
      {
        id: "navigation",
        selector: '[data-tour="primary-navigation"]',
        title: t("layout.walkthrough.steps.navigation.title"),
        description: t("layout.walkthrough.steps.navigation.description"),
      },
      {
        id: "search",
        selector: '[data-tour="global-search"]',
        title: t("layout.walkthrough.steps.search.title"),
        description: t("layout.walkthrough.steps.search.description"),
      },
      {
        id: "ai",
        selector: '[data-tour="ai-agents"]',
        title: t("layout.walkthrough.steps.ai.title"),
        description: t("layout.walkthrough.steps.ai.description"),
      },
      {
        id: "quickActions",
        selector: '[data-tour="quick-actions"]',
        title: t("layout.walkthrough.steps.quickActions.title"),
        description: t("layout.walkthrough.steps.quickActions.description"),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) {
      setStepsResolved(false);
      return undefined;
    }

    const visibleSteps = stepDefinitions.filter((step) => Boolean(document.querySelector(step.selector)));
    setAvailableSteps(visibleSteps);
    setStepIndex(0);
    setStepsResolved(true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, stepDefinitions]);

  useEffect(() => {
    if (!open || !stepsResolved || availableSteps.length > 0) {
      return undefined;
    }

    onClose();
    return undefined;
  }, [availableSteps.length, onClose, open, stepsResolved]);

  const currentStep = availableSteps[stepIndex] || null;

  useEffect(() => {
    if (!open || !currentStep) {
      return undefined;
    }

    const target = document.querySelector(currentStep.selector);
    if (!target) {
      setTargetRect(null);
      return undefined;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    const updateRect = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    };

    updateRect();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateRect) : null;
    resizeObserver?.observe(target);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        setStepIndex((current) => clamp(current + (isRTL ? -1 : 1), 0, availableSteps.length - 1));
      }

      if (event.key === "ArrowLeft") {
        setStepIndex((current) => clamp(current + (isRTL ? 1 : -1), 0, availableSteps.length - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [availableSteps.length, isRTL, onClose, open]);

  const tooltipStyle = useMemo(() => {
    if (!targetRect || typeof window === "undefined") {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_PADDING * 2);
    const showBelow = targetRect.top < viewportHeight * 0.5;
    const left = clamp(
      isRTL ? targetRect.left + targetRect.width - width : targetRect.left,
      VIEWPORT_PADDING,
      viewportWidth - width - VIEWPORT_PADDING,
    );
    const top = showBelow
      ? clamp(targetRect.top + targetRect.height + 18, VIEWPORT_PADDING, viewportHeight - TOOLTIP_ESTIMATED_HEIGHT)
      : clamp(targetRect.top - TOOLTIP_ESTIMATED_HEIGHT - 18, VIEWPORT_PADDING, viewportHeight - TOOLTIP_ESTIMATED_HEIGHT);

    return { top, left, width };
  }, [isRTL, targetRect]);

  if (!open || !currentStep || !targetRect || !tooltipStyle) {
    return null;
  }

  const isLastStep = stepIndex === availableSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[1200]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="pointer-events-none absolute rounded-[24px] border-2 border-sky-400/90 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.56)] transition-all duration-300"
        style={targetRect}
      />

      <div
        className="absolute rounded-[24px] border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl animate-popIn"
        style={tooltipStyle}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-500">
              {t("layout.walkthrough.badge")}
            </div>
            <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">
              {currentStep.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("common.close")}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className={`text-sm leading-6 text-slate-600 ${isRTL ? "text-right" : "text-left"}`}>
          {currentStep.description}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {availableSteps.map((step, index) => (
            <span
              key={step.id}
              className={`h-1.5 rounded-full transition-all duration-200 ${index === stepIndex ? "w-7 bg-sky-500" : "w-2 bg-slate-200"}`}
            />
          ))}
          <span className={`${isRTL ? "mr-auto" : "ml-auto"} text-[11px] font-semibold text-slate-400`}>
            {t("layout.walkthrough.stepCounter", { current: stepIndex + 1, total: availableSteps.length })}
          </span>
        </div>

        <div className={`mt-5 flex items-center gap-2 ${isRTL ? "justify-start" : "justify-end"}`}>
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700"
            >
              {t("layout.walkthrough.back")}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700"
          >
            {t("layout.walkthrough.skip")}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isLastStep) {
                onClose();
                return;
              }

              setStepIndex((current) => Math.min(availableSteps.length - 1, current + 1));
            }}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-600"
          >
            {isLastStep ? t("layout.walkthrough.finish") : t("layout.walkthrough.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
