import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import mongezMark from "../../assets/MongezMLogo.svg";
import { useAppContext } from "../AppContext";
import {
  useOnboardingSetupMutation,
  useOnboardingTemplatesQuery,
} from "../../hooks/useOnboardingQueries";

const INDUSTRY_SUGGESTIONS = ["NGO", "Education", "Healthcare", "Government", "Technology", "Services"];
const TEAM_SIZE_SUGGESTIONS = ["1-10", "11-50", "51-200", "201-500", "500+"];
const DEFAULT_INVITE = { email: "", role: "MEMBER" };

function readPendingOnboarding() {
  try {
    const raw = window.localStorage.getItem("pendingOnboarding");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeInvites(invites) {
  if (!Array.isArray(invites) || !invites.length) {
    return [DEFAULT_INVITE];
  }

  return invites.map((invite) => ({
    email: invite?.email || "",
    role: String(invite?.role || "MEMBER").toUpperCase(),
  }));
}

function countBoards(template) {
  return Array.isArray(template?.departments)
    ? template.departments.reduce((total, department) => total + (department?.boards?.length || 0), 0)
    : 0;
}

function countColumns(template) {
  if (!Array.isArray(template?.departments)) {
    return 0;
  }

  return template.departments.reduce(
    (total, department) =>
      total +
      (department?.boards || []).reduce((boardTotal, board) => boardTotal + (board?.columns?.length || 0), 0),
    0,
  );
}

export default function OnboardingPage() {
  const { user, refreshApp } = useAppContext();
  const pending = useMemo(() => readPendingOnboarding(), []);
  const [error, setError] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [organization, setOrganization] = useState(() => ({
    name: pending?.organization?.name || "",
    industry: pending?.organization?.industry || "",
    size: pending?.organization?.size || "",
    country: pending?.organization?.country || "",
  }));
  const [template, setTemplate] = useState(() => pending?.template || "");
  const [invites, setInvites] = useState(() => normalizeInvites(pending?.invites));
  const templatesQuery = useOnboardingTemplatesQuery();
  const setupMutation = useOnboardingSetupMutation();
  const templates = templatesQuery.data || [];
  const loadingTemplates = templatesQuery.isLoading;
  const submitting = setupMutation.isPending;

  useEffect(() => {
    if (templatesQuery.isError) {
      setError(templatesQuery.error?.message || "Unable to load onboarding templates.");
    }
  }, [templatesQuery.error?.message, templatesQuery.isError]);

  useEffect(() => {
    if (!templates.length) {
      return;
    }

    setTemplate((current) => (
      current && templates.some((item) => item.id === current)
        ? current
        : templates[0]?.id || ""
    ));
  }, [templates]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === template) || null,
    [template, templates],
  );

  const primaryBoard = useMemo(
    () => selectedTemplate?.departments?.[0]?.boards?.[0] || null,
    [selectedTemplate],
  );

  const handleInviteChange = (index, field, value) => {
    setInvites((current) => current.map((invite, inviteIndex) => (
      inviteIndex === index ? { ...invite, [field]: value } : invite
    )));
  };

  const handleAddInvite = () => {
    setInvites((current) => [...current, DEFAULT_INVITE]);
  };

  const handleRemoveInvite = (index) => {
    setInvites((current) => (
      current.length === 1
        ? [DEFAULT_INVITE]
        : current.filter((_, inviteIndex) => inviteIndex !== index)
    ));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setCompletionMessage("");

    const cleanInvites = invites
      .map((invite) => ({
        email: invite.email.trim(),
        role: invite.role || "MEMBER",
      }))
      .filter((invite) => invite.email);

    try {
      const createdSpace = await setupMutation.mutateAsync({
        organization,
        template,
        invites: cleanInvites,
      });

      const createdSpaceId = createdSpace?.id || "";
      const firstBoardId = createdSpace?.departments?.[0]?.boards?.[0]?.id || "";

      window.localStorage.setItem("mongez.activeSpaceId", createdSpaceId);

      if (firstBoardId) {
        window.localStorage.setItem("mongez.activeBoardId", firstBoardId);
      }

      window.localStorage.removeItem("pendingOnboarding");
      setCompletionMessage(cleanInvites.length ? "Workspace created and invitations sent." : "Workspace created successfully.");
      await refreshApp?.();
      window.location.href = "/dashboard";
    } catch (submitError) {
      setError(submitError.message || "Unable to complete onboarding.");
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_100%)]">
      <div className="mx-auto max-w-[1120px] px-6 py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={mongezMark} alt="" className="h-10 w-10" />
            <div>
              <div className="text-[20px] font-extrabold tracking-[-0.03em] text-slate-900">Mongez</div>
              <div className="text-[12px] font-medium text-slate-500">Finalize your real workspace setup</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="text-left text-[13px] font-semibold text-slate-400 transition hover:text-slate-900 sm:text-right"
          >
            Skip for now
          </button>
        </header>

        <div className="mx-auto mt-8 max-w-[720px] rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="mb-8">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-[22px] text-sky-600">
                  <i className="fa-solid fa-building" aria-hidden="true" />
                </div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-sky-500">Onboarding</p>
                <h1 className="text-[30px] font-black tracking-[-0.04em] text-slate-900">
                  Welcome, {user.name || user.email}
                </h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">
                  Configure your workspace from the real onboarding templates already exposed by the platform, then invite your first team members without relying on placeholder data.
                </p>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Workspace", detail: "Name and region" },
                  { label: "Template", detail: "Live backend catalog" },
                  { label: "Team", detail: "Real invitations" },
                  { label: "Launch", detail: "Open dashboard" },
                ].map((step, index) => (
                  <div key={step.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</div>
                    <div className="mt-1 text-sm font-bold text-slate-800">{step.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{step.detail}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Organization name</label>
                  <input
                    value={organization.name}
                    onChange={(event) => setOrganization((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Al Noor Foundation"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Industry</label>
                    <input
                      list="industry-suggestions"
                      value={organization.industry}
                      onChange={(event) => setOrganization((current) => ({ ...current, industry: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      placeholder="NGO"
                    />
                    <datalist id="industry-suggestions">
                      {INDUSTRY_SUGGESTIONS.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Team size</label>
                    <input
                      list="team-size-suggestions"
                      value={organization.size}
                      onChange={(event) => setOrganization((current) => ({ ...current, size: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                      placeholder="11-50"
                    />
                    <datalist id="team-size-suggestions">
                      {TEAM_SIZE_SUGGESTIONS.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Country or region</label>
                  <input
                    value={organization.country}
                    onChange={(event) => setOrganization((current) => ({ ...current, country: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Egypt"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-slate-700">Workspace template</label>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      API-backed options
                    </span>
                  </div>

                  {loadingTemplates ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Loading templates...
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {templates.map((item) => {
                        const selected = item.id === template;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTemplate(item.id)}
                            className={`rounded-3xl border p-4 text-left transition ${
                              selected
                                ? "border-sky-400 bg-sky-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-bold text-slate-900">{item.name}</div>
                              {selected ? (
                                <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500">{item.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Initial invites</h2>
                      <p className="mt-1 text-xs text-slate-500">These are sent through the real onboarding payload, not a mock step.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddInvite}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
                    >
                      Add teammate
                    </button>
                  </div>

                  <div className="space-y-3">
                    {invites.map((invite, index) => (
                      <div key={`${index}-${invite.email}`} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                        <input
                          type="email"
                          value={invite.email}
                          onChange={(event) => handleInviteChange(index, "email", event.target.value)}
                          placeholder="teammate@company.com"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                        />
                        <select
                          value={invite.role}
                          onChange={(event) => handleInviteChange(index, "role", event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(index)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {error}
                  </div>
                ) : null}

                {completionMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {completionMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || loadingTemplates || !template}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Finishing setup..." : "Create workspace"}
                </button>
              </form>
            </section>

            <aside className="rounded-[26px] bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Template</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight">
                    {selectedTemplate?.name || "Loading templates"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-300">
                  Live catalog
                </div>
              </div>

              {loadingTemplates ? (
                <p className="text-sm text-slate-300">Loading onboarding templates...</p>
              ) : selectedTemplate ? (
                <div className="space-y-5">
                  <p className="text-sm leading-6 text-slate-300">{selectedTemplate.description}</p>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Departments</div>
                      <div className="mt-2 text-2xl font-black">{selectedTemplate.departments?.length || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Boards</div>
                      <div className="mt-2 text-2xl font-black">{countBoards(selectedTemplate)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Workflows</div>
                      <div className="mt-2 text-2xl font-black">{selectedTemplate.workflows?.length || 0}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{primaryBoard?.name || "Board preview"}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {countColumns(selectedTemplate)} configured columns across the selected workspace template.
                        </p>
                      </div>
                      <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-200">
                        {selectedTemplate.id}
                      </span>
                    </div>

                    {primaryBoard?.columns?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {primaryBoard.columns.map((column) => (
                          <span
                            key={column.name}
                            className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-slate-200"
                          >
                            {column.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">This template has no board preview available.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedTemplate.departments?.map((department) => (
                      <div key={department.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-white">{department.name}</div>
                            <div className="mt-1 text-xs text-slate-400">{department.description}</div>
                          </div>
                          <div className="text-xs font-semibold text-slate-300">
                            {department.boards?.length || 0} board{department.boards?.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                  No onboarding templates were returned by the API.
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
