import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../../../components/ui/Button";
import useLocaleDirection from "../../../hooks/useLocaleDirection";

const FocusBanner = ({ criticalTask, onFocusStart }) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const dueLabel = criticalTask.due
    ? t("myWorkPage.dueLabel", { value: criticalTask.due })
    : "";

  return (
    <div
      className={`bg-gradient-to-r from-indigo-500 to-sky-500 rounded-xl px-6 py-5 flex items-center justify-between gap-4 mb-6 ${
        isRtl ? "text-right" : "text-left"
      }`}
      role="region"
      aria-label={t("myWorkPage.focusMode")}
      dir={dir}
    >
      <div>
        <h3 className="text-[16px] font-bold text-white flex items-center gap-2 mb-1">
          <i className="fa-solid fa-crosshairs" aria-hidden="true" />
          {t("myWorkPage.focusMode")}
        </h3>
        <p className="text-[13px] text-white/85 leading-relaxed">
          {t("myWorkPage.criticalTask")}{" "}
          <strong className="text-white">{criticalTask.name}</strong>
          {criticalTask.due && ` - ${dueLabel}`}
        </p>
      </div>
      <Button variant="focus-white" size="md" onClick={onFocusStart} className="shrink-0">
        <i className="fa-solid fa-play text-[11px]" aria-hidden="true" />
        {t("myWorkPage.startFocus")}
      </Button>
    </div>
  );
};

export default FocusBanner;
