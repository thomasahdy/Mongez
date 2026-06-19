import { FaArrowLeft, FaArrowRight, FaChartBar, FaClipboardList } from "react-icons/fa";
import AuthButton from "../../shared/AuthButton";

const templates = [
  {
    id: "project-board",
    name: "Project Board",
    icon: FaClipboardList,
    description: "General task management",
  },
  {
    id: "ngo-operations",
    name: "NGO Operations",
    emoji: "🏛️",
    description: "Donor reports, procurement",
  },
  {
    id: "budget-tracker",
    name: "Budget Tracker",
    icon: FaChartBar,
    description: "Finance & allocation",
  },
  {
    id: "education-program",
    name: "Education Program",
    emoji: "🎓",
    description: "Curriculum & schools",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    emoji: "🏥",
    description: "Clinics & resources",
  },
  {
    id: "blank",
    name: "Blank",
    emoji: "⚡",
    description: "Start from scratch",
  },
];

const TemplateStep = ({ selectedTemplate, onSelectTemplate, onNext, onBack }) => {
  return (
    <div className="animate-fadeIn">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1 text-center">
        Choose a starting template
      </h1>

      <p className="text-[13px] text-text-secondary mb-7 text-center">
        Pick a template to set up your first workspace. You can change it later.
      </p>

      <div className="grid grid-cols-1 min-[580px]:grid-cols-2 gap-2.5 mb-6">
        {templates.map((template) => {
          const Icon = template.icon;
          const selected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template.id)}
              className={`relative p-4 border-[1.5px] rounded-lg text-left cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                selected
                  ? "border-primary bg-primary-light shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:border-primary hover:bg-primary-light"
              }`}
            >
              <div className="text-lg mb-2 text-primary flex items-center justify-center">
                {Icon ? <Icon className="text-[20px]" /> : <span className="text-[20px]">{template.emoji}</span>}
              </div>
              <div className="text-[13px] font-semibold text-text-primary mb-0.5 text-center">
                {template.name}
              </div>
              <div className="text-[11px] text-text-tertiary text-center">
                {template.description}
              </div>
              {selected && (
                <div className="absolute top-3 right-3 text-primary">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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

      <div className="flex gap-3">
        <AuthButton variant="outline" onClick={onBack}>
          <FaArrowLeft className="text-[10px]" /> Back
        </AuthButton>
        <AuthButton onClick={onNext}>
          Continue <FaArrowRight className="text-[10px]" />
        </AuthButton>
      </div>
    </div>
  );
};

export default TemplateStep;
