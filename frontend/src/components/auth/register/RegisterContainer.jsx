import { useState } from "react";
import AuthFooterLink from "../shared/AuthFooterLink";
import RegisterCard from "./RegisterCard";
import RegisterStepper from "./RegisterStepper";
import AccountStep from "./steps/AccountStep";
import InviteStep from "./steps/InviteStep";
import OrganizationStep from "./steps/OrganizationStep";
import TemplateStep from "./steps/TemplateStep";

const initialValues = {
  account: {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  },
  organization: {
    name: "",
    industry: "",
    size: "11-50",
    country: "Egypt",
  },
  template: "project-board",
  invites: [
    { email: "", role: "Member" },
    { email: "", role: "Member" },
  ],
};

const RegisterContainer = () => {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [direction, setDirection] = useState("forward");

  const updateSection = (section, field, value) => {
    setValues((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const setTemplate = (template) => {
    setValues((current) => ({ ...current, template }));
  };

  const setInvites = (invites) => {
    setValues((current) => ({ ...current, invites }));
  };

  const goToStep = (newStep) => {
    setDirection(newStep > step ? "forward" : "backward");
    setStep(newStep);
  };

  const handleSubmit = async ({ skipInvites = false } = {}) => {
    setLoading(true);
    setSubmitError("");

    const payload = {
      organization: values.organization,
      template: values.template,
      invites: skipInvites
        ? []
        : values.invites.filter((invite) => invite.email && invite.email.trim()),
    };

    try {
      const response = await fetch("/api/v1/auth/complete-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || "Failed to complete onboarding";
        setSubmitError(errorMessage);
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      const errorMessage = error?.message || error?.toString?.() || "Something went wrong";
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const stepAnimation = direction === "forward" ? "animate-slideLeft" : "animate-slideRight";

  return (
    <div className="w-full max-w-[520px]">
      <div className="flex justify-center mb-8">
        <a href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#00a8e8" />
            <path d="M8 22V10l5 8 5-8v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="24" cy="10" r="2" fill="#6366f1" />
          </svg>
          <span className="text-[22px] leading-none font-extrabold tracking-[-0.5px] text-text-primary">Mongez</span>
        </a>
      </div>

      <RegisterStepper step={step} />

      <RegisterCard>
        <div key={step} className={stepAnimation}>
          {step === 1 && (
            <AccountStep
              values={values.account}
              onChange={(field, value) => updateSection("account", field, value)}
              onNext={() => goToStep(2)}
            />
          )}

          {step === 2 && (
            <OrganizationStep
              values={values.organization}
              onChange={(field, value) => updateSection("organization", field, value)}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}

          {step === 3 && (
            <TemplateStep
              selectedTemplate={values.template}
              onSelectTemplate={setTemplate}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}

          {step === 4 && (
            <InviteStep
              invites={values.invites}
              onChange={setInvites}
              onBack={() => goToStep(3)}
              onSubmit={handleSubmit}
              loading={loading}
              submitError={submitError}
            />
          )}
        </div>
      </RegisterCard>

      <AuthFooterLink
        text="Already have an account?"
        linkText="Log in"
        href="/login"
        className="mt-6"
      />
    </div>
  );
};

export default RegisterContainer;