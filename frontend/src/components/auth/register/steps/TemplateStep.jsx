import { useState } from "react";
import { FaArrowLeft, FaArrowRight, FaChartBar, FaClipboardList } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthButton from "../../shared/AuthButton";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import { useLocaleDirection } from "../../../../hooks/useLocaleDirection";

const templates = [
  {
    id: "software-dev",
    name: "Software Development",
    icon: FaClipboardList,
    description: "Sprint delivery, bug tracking, and QA workflow",
  },
  {
    id: "ngo-ops",
    name: "NGO Operations",
    emoji: "Programs",
    description: "Grant proposals, donor reviews, and budget approvals",
  },
  {
    id: "marketing-agency",
    name: "Marketing Agency",
    icon: FaChartBar,
    description: "Creative pipeline, client review, and publishing stages",
  },
];

const TemplateStep = ({ selectedTemplate, onSelectTemplate, onNext, onBack }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [error, setError] = useState("");
  const templateCopy = t("registerUi.template.items", { returnObjects: true });
  const mergedTemplates = templates.map((template, index) => ({
    ...template,
    ...templateCopy[index],
  }));

  const handleSelect = (id) => {
    setError("");
    onSelectTemplate(id);
  };

  const handleContinue = () => {
    if (!selectedTemplate) {
      setError(t("registerUi.template.validations.selectionRequired"));
      return;
    }
    onNext();
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-1 text-center text-[22px] font-extrabold tracking-[-0.5px] text-text-primary">
        {t("registerUi.template.title")}
      </h1>

      <p className="mb-7 text-center text-[13px] text-text-secondary">
        {t("registerUi.template.description")}
      </p>

      <div className="mb-6 grid grid-cols-1 gap-2.5 min-[580px]:grid-cols-2">
        {mergedTemplates.map((template) => {
          const Icon = template.icon;
          const selected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template.id)}
              className={`relative cursor-pointer rounded-lg border-[1.5px] p-4 transition-all duration-200 hover:scale-[1.02] ${
                selected
                  ? "border-primary bg-primary-light shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:border-primary hover:bg-primary-light"
              }`}
            >
              <div className="mb-2 flex items-center justify-center text-lg text-primary">
                {Icon ? <Icon className="text-[20px]" /> : <span className="text-[15px] font-semibold">{template.emoji}</span>}
              </div>
              <div className="mb-0.5 text-center text-[13px] font-semibold text-text-primary">
                {template.name}
              </div>
              <div className="text-center text-[11px] text-text-tertiary">
                {template.description}
              </div>
              {selected && (
                <div className={`absolute top-3 text-primary ${isRTL ? "left-3" : "right-3"}`}>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <AuthErrorMessage className="mb-4">{error}</AuthErrorMessage>

      <div className={`flex gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <AuthButton variant="outline" onClick={onBack} className={isRTL ? "flex-row-reverse" : ""}>
          {isRTL ? (
            <>
              {t("registerUi.template.back")}
              <FaArrowLeft className="rotate-180 text-[10px]" />
            </>
          ) : (
            <>
              <FaArrowLeft className="text-[10px]" />
              {t("registerUi.template.back")}
            </>
          )}
        </AuthButton>
        <AuthButton onClick={handleContinue} className={isRTL ? "flex-row-reverse" : ""}>
          {isRTL ? (
            <>
              {t("registerUi.template.continue")}
              <FaArrowRight className="rotate-180 text-[10px]" />
            </>
          ) : (
            <>
              {t("registerUi.template.continue")}
              <FaArrowRight className="text-[10px]" />
            </>
          )}
        </AuthButton>
      </div>
    </div>
  );
};

export default TemplateStep;