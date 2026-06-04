import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import AuthButton from "../../shared/AuthButton";
import AuthInput from "../../shared/AuthInput";

const industries = [
  "NGO / Non-Profit",
  "Government",
  "Education",
  "Healthcare",
  "Technology",
  "Finance",
  "Other",
];

const countries = ["Egypt", "Saudi Arabia", "UAE", "Jordan", "Other"];

const sizeOptions = [
  { value: "1-10", label: "Small" },
  { value: "11-50", label: "Medium" },
  { value: "51-200", label: "Large" },
  { value: "201-500", label: "Enterprise" },
  { value: "500+", label: "Corporation" },
];

const selectClasses =
  "w-full py-[11px] px-3.5 text-[13px] border-[1.5px] border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer";

const OrganizationStep = ({ values, onChange, onNext, onBack }) => {
  return (
    <div className="animate-fadeIn">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1 text-center">
        Set up your organization
      </h1>

      <p className="text-[13px] text-text-secondary mb-7 text-center">
        Tell us about your organization so we can customize your experience.
      </p>

      <div className="space-y-[18px]">
        <AuthInput
          label="Organization name"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="e.g. Al-Noor Foundation"
        />

        <div>
          <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
            Industry
          </label>
          <select
            value={values.industry}
            onChange={(event) => onChange("industry", event.target.value)}
            className={selectClasses}
          >
            <option value="">Select industry...</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-text-primary mb-2">
            Organization size
          </label>
          <div className="grid grid-cols-1 min-[580px]:grid-cols-3 gap-2.5">
            {sizeOptions.map((option) => {
              const isSelected = values.size === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange("size", option.value)}
                  className={`px-2.5 py-3.5 border-[1.5px] rounded-lg text-center transition-all duration-200 text-xs font-medium ${
                    isSelected
                      ? "border-primary bg-primary-light text-primary shadow-sm"
                      : "border-border hover:border-primary hover:bg-primary-light text-text-primary"
                  }`}
                >
                  <span className="block text-lg font-extrabold mb-0.5">{option.value}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
            Country
          </label>
          <select
            value={values.country}
            onChange={(event) => onChange("country", event.target.value)}
            className={selectClasses}
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1.5">
          <AuthButton variant="outline" onClick={onBack}>
            <FaArrowLeft className="text-[10px]" /> Back
          </AuthButton>
          <AuthButton onClick={onNext}>
            Continue <FaArrowRight className="text-[10px]" />
          </AuthButton>
        </div>
      </div>
    </div>
  );
};

export default OrganizationStep;