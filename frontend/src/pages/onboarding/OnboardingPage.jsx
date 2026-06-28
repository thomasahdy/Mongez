import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import mongezMark from "../../assets/MongezMLogo.svg";
import { useOnboardingSetupMutation, useOnboardingTemplatesQuery } from "../../hooks/useOnboardingQueries";

const ONBOARDING_STORAGE_KEY = "pendingOnboarding";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onboardingSetupMutation = useOnboardingSetupMutation();
  const templatesQuery = useOnboardingTemplatesQuery();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("NGO");
  const [size, setSize] = useState("MEDIUM");
  const [country, setCountry] = useState("EG");
  const [selectedTemplate, setSelectedTemplate] = useState("project-board");
  const [invites, setInvites] = useState([{ email: "", role: "MEMBER" }]);

  const industries = t("onboarding.industries", { returnObjects: true });
  const sizes = t("onboarding.sizes", { returnObjects: true });
  const fallbackTemplates = t("onboarding.templates", { returnObjects: true }).map((template) => ({
    ...template,
    icon: template.id === "project-board" ? "PB" : template.id === "ngo-operations" ? "NG" : "BL",
  }));

  const templates = templatesQuery.data?.length > 0 ? templatesQuery.data : fallbackTemplates;

  useEffect(() => {
    try {
      const rawPending = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!rawPending) {
        return;
      }

      const pending = JSON.parse(rawPending);
      if (pending?.organization?.name) setOrgName(pending.organization.name);
      if (pending?.organization?.industry) setIndustry(pending.organization.industry);
      if (pending?.organization?.size) setSize(pending.organization.size);
      if (pending?.organization?.country) setCountry(String(pending.organization.country).toUpperCase());
      if (pending?.template) setSelectedTemplate(pending.template);
      if (Array.isArray(pending?.invites) && pending.invites.length > 0) {
        setInvites(
          pending.invites.map((invite) => ({
            email: invite.email || "",
            role: String(invite.role || "MEMBER").toUpperCase(),
          })),
        );
      }
    } catch {
      // Ignore stale onboarding cache.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({
          organization: {
            name: orgName,
            industry,
            size,
            country,
          },
          template: selectedTemplate,
          invites,
        }),
      );
    } catch {
      // Ignore persistence issues and keep onboarding usable.
    }
  }, [country, industry, invites, orgName, selectedTemplate, size]);

  useEffect(() => {
    const titles = t("onboarding.stepsTitle", { returnObjects: true });
    document.title = `${titles[step - 1]} - Mongez`;
    return () => {
      document.title = "Mongez";
    };
  }, [step, t]);

  const loading = onboardingSetupMutation.isPending;
  const trimmedOrgName = orgName.trim();
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedInvites = invites
    .map((invite) => ({
      email: invite.email.trim().toLowerCase(),
      role: String(invite.role || "MEMBER").toUpperCase(),
    }))
    .filter((invite) => invite.email !== "");
  const duplicateInviteEmail = normalizedInvites.find(
    (invite, index) => normalizedInvites.findIndex((item) => item.email === invite.email) !== index,
  )?.email;

  const handleAddInvite = () => {
    setInvites((current) => [...current, { email: "", role: "MEMBER" }]);
  };

  const handleInviteChange = (index, field, value) => {
    setInvites((current) =>
      current.map((invite, currentIndex) =>
        currentIndex === index ? { ...invite, [field]: value } : invite,
      ),
    );
  };

  const handleRemoveInvite = (index) => {
    setInvites((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleNextStep = () => {
    if (step === 1 && trimmedOrgName.length < 3) {
      setError(t("onboarding.errors.orgName"));
      return;
    }

    if (step === 1 && !/^[A-Z]{2}$/.test(normalizedCountry)) {
      setError(t("onboarding.errors.country"));
      return;
    }

    if (step === 3 && duplicateInviteEmail) {
      setError(t("onboarding.errors.duplicateInvite", { email: duplicateInviteEmail }));
      return;
    }

    setError("");
    setStep((current) => current + 1);
  };

  const handlePrevStep = () => {
    setError("");
    setStep((current) => current - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (trimmedOrgName.length < 3) {
      setStep(1);
      setError(t("onboarding.errors.orgName"));
      return;
    }

    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
      setStep(1);
      setError(t("onboarding.errors.country"));
      return;
    }

    if (duplicateInviteEmail) {
      setStep(3);
      setError(t("onboarding.errors.duplicateInvite", { email: duplicateInviteEmail }));
      return;
    }

    const invalidInvite = normalizedInvites.find((invite) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email));
    if (invalidInvite) {
      setStep(3);
      setError(t("onboarding.errors.invalidInvite", { email: invalidInvite.email }));
      return;
    }

    setError("");

    try {
      await onboardingSetupMutation.mutateAsync({
        organization: {
          name: trimmedOrgName,
          industry,
          size,
          country: normalizedCountry,
        },
        template: selectedTemplate,
        invites: normalizedInvites,
      });

      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      navigate("/spaces", { replace: true });
    } catch (requestError) {
      setError(requestError.message || t("onboarding.errors.failed"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
        <div className="flex items-center gap-2.5">
          <img src={mongezMark} alt="" className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight">{t("onboarding.brand")}</span>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t("onboarding.stepCounter", { step, total: 3 })}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            {t("onboarding.draftSaved")}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">{t("onboarding.createWorkspace.title")}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t("onboarding.createWorkspace.description")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="orgName">
                      {t("onboarding.createWorkspace.organizationName")}
                    </label>
                    <input
                      id="orgName"
                      type="text"
                      required
                      placeholder={t("onboarding.createWorkspace.organizationPlaceholder")}
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="industry">
                        {t("onboarding.createWorkspace.industry")}
                      </label>
                      <select
                        id="industry"
                        value={industry}
                        onChange={(event) => setIndustry(event.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                      >
                        {industries.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="size">
                        {t("onboarding.createWorkspace.size")}
                      </label>
                      <select
                        id="size"
                        value={size}
                        onChange={(event) => setSize(event.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                      >
                        {sizes.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="country">
                      {t("onboarding.createWorkspace.country")}
                    </label>
                    <input
                      id="country"
                      type="text"
                      maxLength={2}
                      placeholder={t("onboarding.createWorkspace.countryPlaceholder")}
                      value={country}
                      onChange={(event) => setCountry(event.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm font-semibold tracking-wide"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm cursor-pointer disabled:opacity-60"
                    disabled={loading}
                  >
                    {t("onboarding.buttons.continue")}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">{t("onboarding.chooseTemplate.title")}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t("onboarding.chooseTemplate.description")}</p>
                </div>

                {templatesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer flex gap-4 items-start ${
                          selectedTemplate === template.id
                            ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        }`}
                      >
                        <span className="text-sm font-black tracking-[0.16em] p-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 w-12 h-12">
                          {template.icon}
                        </span>
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm">{template.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{template.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm cursor-pointer"
                  >
                    {t("onboarding.buttons.back")}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm cursor-pointer"
                  >
                    {t("onboarding.buttons.continue")}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">{t("onboarding.inviteTeam.title")}</h2>
                  <p className="text-sm text-slate-500 mt-1">{t("onboarding.inviteTeam.description")}</p>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {invites.map((invite, index) => (
                    <div key={index} className="flex gap-2 items-center animate-fadeIn">
                      <input
                        type="email"
                        placeholder={t("onboarding.inviteTeam.emailPlaceholder")}
                        value={invite.email}
                        onChange={(event) => handleInviteChange(index, "email", event.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                      />
                      <select
                        value={invite.role}
                        onChange={(event) => handleInviteChange(index, "role", event.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                      >
                        <option value="MEMBER">{t("onboarding.roles.MEMBER")}</option>
                        <option value="ADMIN">{t("onboarding.roles.ADMIN")}</option>
                        <option value="VIEWER">{t("onboarding.roles.VIEWER")}</option>
                      </select>
                      {invites.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(index)}
                          className="p-2.5 text-slate-400 hover:text-red-500 transition rounded-lg"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddInvite}
                  className="text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1.5 focus:outline-none"
                >
                  + {t("onboarding.inviteTeam.addInvite")}
                </button>

                {duplicateInviteEmail ? (
                  <p className="text-xs text-rose-600">{t("onboarding.inviteTeam.duplicateInvite", { email: duplicateInviteEmail })}</p>
                ) : null}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {t("onboarding.buttons.back")}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? t("onboarding.inviteTeam.settingUp") : t("onboarding.inviteTeam.completeSetup")}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
