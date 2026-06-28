import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthButton from "../../shared/AuthButton";
import AuthInput from "../../shared/AuthInput";
import { useLocaleDirection } from "../../../../hooks/useLocaleDirection";

const industryValues = [
  "NGO / Non-Profit",
  "Government",
  "Education",
  "Healthcare",
  "Technology",
  "Finance",
  "Other",
];

const countryValues = ["Egypt", "Saudi Arabia", "UAE", "Jordan", "Other"];

const selectClasses =
  "w-full cursor-pointer rounded-lg border-[1.5px] border-border bg-white px-3.5 py-[11px] text-[13px] text-start transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";

const OrganizationStep = ({ values, onChange, onNext, onBack }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const industryLabels = t("registerUi.organization.industries", { returnObjects: true });
  const countryLabels = t("registerUi.organization.countries", { returnObjects: true });
  const sizeOptions = t("registerUi.organization.sizes", { returnObjects: true });

  return (
    <div className="animate-fadeIn">
      <h1 className="mb-1 text-center text-[22px] font-extrabold tracking-[-0.5px] text-text-primary">
        {t("registerUi.organization.title")}
      </h1>

      <p className="mb-7 text-center text-[13px] text-text-secondary">
        {t("registerUi.organization.description")}
      </p>

      <div className="space-y-3.5">
        <AuthInput
          label={t("registerUi.organization.organizationName")}
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder={t("registerUi.organization.organizationNamePlaceholder")}
        />

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-primary text-start">
            {t("registerUi.organization.industry")}
          </label>
          <select
            value={values.industry}
            onChange={(event) => onChange("industry", event.target.value)}
            className={selectClasses}
          >
            <option value="">{t("registerUi.organization.selectIndustry")}</option>
            {industryValues.map((industry, index) => (
              <option key={industry} value={industry}>
                {industryLabels[index] || industry}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-semibold text-text-primary text-start">
            {t("registerUi.organization.organizationSize")}
          </label>
          <div className="grid grid-cols-1 gap-2.5 min-[580px]:grid-cols-3">
            {sizeOptions.map((option) => {
              const isSelected = values.size === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange("size", option.value)}
                  className={`rounded-lg border-[1.5px] px-2.5 py-3.5 text-center text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-primary-light text-primary shadow-sm"
                      : "border-border text-text-primary hover:border-primary hover:bg-primary-light"
                  }`}
                >
                  <span className="mb-0.5 block text-lg font-extrabold">{option.value}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-primary text-start">
            {t("registerUi.organization.country")}
          </label>
          <select
            value={values.country}
            onChange={(event) => onChange("country", event.target.value)}
            className={selectClasses}
          >
            {countryValues.map((country, index) => (
              <option key={country} value={country}>
                {countryLabels[index] || country}
              </option>
            ))}
          </select>
        </div>

        <div className={`flex gap-3 pt-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          <AuthButton variant="outline" onClick={onBack} className={isRTL ? "flex-row-reverse" : ""}>
            {isRTL ? (
              <>
                {t("registerUi.organization.back")}
                <FaArrowLeft className="rotate-180 text-[10px]" />
              </>
            ) : (
              <>
                <FaArrowLeft className="text-[10px]" />
                {t("registerUi.organization.back")}
              </>
            )}
          </AuthButton>
          <AuthButton onClick={onNext} className={isRTL ? "flex-row-reverse" : ""}>
            {isRTL ? (
              <>
                {t("registerUi.organization.continue")}
                <FaArrowRight className="rotate-180 text-[10px]" />
              </>
            ) : (
              <>
                {t("registerUi.organization.continue")}
                <FaArrowRight className="text-[10px]" />
              </>
            )}
          </AuthButton>
        </div>
      </div>
    </div>
  );
};

export default OrganizationStep;
