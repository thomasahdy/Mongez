import { useState } from "react";
import AuthFooterLink from "../shared/AuthFooterLink";
import RegisterCard from "./RegisterCard";
import RegisterStepper from "./RegisterStepper";
import AccountStep from "./steps/AccountStep";
import InviteStep from "./steps/InviteStep";
import OrganizationStep from "./steps/OrganizationStep";
import TemplateStep from "./steps/TemplateStep";
import authService from "../../../services/api/authService";
import AuthLogo from "../shared/AuthLogo";

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
  template: "software-dev",
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
      [section]: { ...current[section], [field]: value },
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

    localStorage.setItem(
      "pendingOnboarding",
      JSON.stringify({
        organization: values.organization,
        template: values.template,
        invites: skipInvites
          ? []
          : values.invites.filter((invite) => invite.email.trim()),
      })
    );

    try {
      const fullName = [values.account.firstName, values.account.lastName].filter(Boolean).join(" ").trim();
      await authService.register({
        email: values.account.email.trim(),
        password: values.account.password,
        name: fullName,
      });
      window.location.href = "/onboarding";
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
      <AuthLogo />

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
            onSkip={() => handleSubmit({ skipInvites: true })}
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
        className="mt-4"
      />
    </div>
  );
};

export default RegisterContainer;
