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
    <div>
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1">
        Choose a starting template
      </h1>

      <p className="text-[13px] text-text-secondary mb-7">
        Pick a template to set up your first workspace. You can change it later.
      </p>

      <div className="grid grid-cols-1 min-[580px]:grid-cols-2 gap-2.5">
        {templates.map((template) => {
          const Icon = template.icon;
          const selected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template.id)}
              className={`p-4 border-[1.5px] rounded text-left cursor-pointer transition ${
                selected
                  ? "border-primary bg-primary-light"
                  : "border-border hover:border-primary hover:bg-primary-light"
              }`}
            >
              <div className="text-xl mb-2 text-primary">
                {Icon ? <Icon /> : <span>{template.emoji}</span>}
              </div>
              <div className="text-[13px] font-semibold text-text-primary mb-0.5">
                {template.name}
              </div>
              <div className="text-[11px] text-text-tertiary">
                {template.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <AuthButton variant="outline" onClick={onBack}>
          <FaArrowLeft className="text-xs" /> Back
        </AuthButton>
        <AuthButton onClick={onNext}>
          Continue <FaArrowRight className="text-xs" />
        </AuthButton>
      </div>
    </div>
  );
};

export default TemplateStep;
