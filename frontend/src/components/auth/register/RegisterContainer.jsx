import { useState } from "react";
import { useDispatch } from "react-redux";
import AuthLogo from "../shared/AuthLogo";
import AuthFooterLink from "../shared/AuthFooterLink";
import RegisterCard from "./RegisterCard";
import RegisterStepper from "./RegisterStepper";
import AccountStep from "./steps/AccountStep";
import InviteStep from "./steps/InviteStep";
import OrganizationStep from "./steps/OrganizationStep";
import TemplateStep from "./steps/TemplateStep";
import { registerUser } from "../../../store/auth/authThunks";


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
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);

  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

    // Auth endpoint contract: POST /api/v1/auth/register { name, email, password }
    const payload = {
      name: `${values.account.firstName} ${values.account.lastName}`.trim(),
      email: values.account.email,
      password: values.account.password,
    };

    try {
      await dispatch(registerUser(payload)).unwrap();
      window.location.href = "#onboarding";
    } catch (error) {
      console.error("Registration failed", error);
      setSubmitError(error?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }

  };

  return (
    <div className="w-full max-w-[500px] animate-fadeIn">
      <div className="flex justify-center">
        <AuthLogo className="mb-5" />
      </div>

      <RegisterStepper step={step} />

      <RegisterCard>
        {step === 1 && (
          <AccountStep
            values={values.account}
            onChange={(field, value) => updateSection("account", field, value)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <OrganizationStep
            values={values.organization}
            onChange={(field, value) => updateSection("organization", field, value)}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <TemplateStep
            selectedTemplate={values.template}
            onSelectTemplate={setTemplate}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <InviteStep
            invites={values.invites}
            onChange={setInvites}
            onBack={() => setStep(3)}
            onSubmit={handleSubmit}
            loading={loading}
            submitError={submitError}
          />
        )}
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
