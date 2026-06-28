import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "./sections/SettingsSidebar";
import { useAppContext } from "../AppContext";
import {
  useInviteSpaceMemberMutation,
  useLeaveSpaceMutation,
  useRemoveSpaceMemberMutation,
  useRevokeSpaceInvitationMutation,
  useSpaceInvitationsQuery,
  useSpaceMembersQuery,
  useUpdateSpaceMemberRoleMutation,
} from "../../hooks/useSettingsQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const ROLE_OPTIONS = ["MEMBER", "ADMIN"];
const MANAGE_ROLES = new Set(["OWNER", "ADMIN"]);

function getMemberName(member) {
  return (
    member?.user?.fullName ||
    member?.user?.name ||
    member?.fullName ||
    member?.name ||
    member?.user?.email ||
    member?.email ||
    ""
  );
}

function getMemberEmail(member) {
  return member?.user?.email || member?.email || "";
}

function getMemberRole(member) {
  return member?.role?.name || member?.role || member?.spaceRole || member?.membershipRole || "MEMBER";
}

function getMemberStatus(member) {
  return member?.user?.status || member?.status || "ACTIVE";
}

function isValidInviteEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

export default function SettingsMembersPage({ setPath }) {
  const { activeSpace, activeSpaceId, error, refreshApp, user } = useAppContext();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [inviteForm, setInviteForm] = useState({ email: "", role: "MEMBER" });
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const membersQuery = useSpaceMembersQuery(activeSpaceId);
  const invitationsQuery = useSpaceInvitationsQuery(activeSpaceId);
  const inviteMutation = useInviteSpaceMemberMutation(activeSpaceId);
  const updateRoleMutation = useUpdateSpaceMemberRoleMutation(activeSpaceId);
  const removeMemberMutation = useRemoveSpaceMemberMutation(activeSpaceId);
  const revokeInvitationMutation = useRevokeSpaceInvitationMutation(activeSpaceId);
  const leaveWorkspaceMutation = useLeaveSpaceMutation(activeSpaceId);
  const spaceMembers = membersQuery.data || [];
  const invitations = invitationsQuery.data?.items || [];
  const canViewInvitations = invitationsQuery.data?.canViewInvitations ?? true;
  const loading = membersQuery.isLoading || membersQuery.isFetching;
  const loadingInvitations = invitationsQuery.isLoading || invitationsQuery.isFetching;
  const normalizedInviteEmail = inviteForm.email.trim().toLowerCase();
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const inviteMatchesExistingMember = spaceMembers.some((member) => getMemberEmail(member).toLowerCase() === normalizedInviteEmail);
  const inviteMatchesPending = invitations.some((invite) => String(invite.email || "").toLowerCase() === normalizedInviteEmail);

  const formatRole = (role) => t(`members.roles.${String(role || "MEMBER").toUpperCase()}`, { defaultValue: String(role || "MEMBER") });
  const formatMemberName = (member) => getMemberName(member) || t("members.labels.memberFallback");
  const formatMemberStatus = (member) =>
    t(`members.statuses.${String(getMemberStatus(member) || "ACTIVE").toUpperCase()}`, {
      defaultValue: String(getMemberStatus(member) || "ACTIVE"),
    });

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    setPath?.([
      { name: t("settingsSidebar.workspace"), color: "text-slate-400", ref: "/settings" },
      { name: t("members.breadcrumb"), color: "text-slate-800", ref: "/settings/members" },
    ]);
  }, [setPath, t]);

  const currentMembership = useMemo(
    () => spaceMembers.find((member) => member?.user?.id === user?.id || member?.userId === user?.id) || null,
    [spaceMembers, user?.id],
  );

  const currentRole = String(getMemberRole(currentMembership)).toUpperCase();
  const canManageMembers = MANAGE_ROLES.has(currentRole);

  useEffect(() => {
    if (membersQuery.isError) {
      setPageError(membersQuery.error?.message || t("members.errors.membersFailed"));
      return;
    }

    if (invitationsQuery.isError) {
      setPageError(invitationsQuery.error?.message || t("members.errors.invitesFailed"));
      return;
    }

    setPageError("");
  }, [
    invitationsQuery.error?.message,
    invitationsQuery.isError,
    membersQuery.error?.message,
    membersQuery.isError,
    t,
  ]);

  const handleRefresh = async () => {
    setPageError("");
    setSuccessMessage("");
    await Promise.all([refreshApp?.(), membersQuery.refetch(), invitationsQuery.refetch()]);
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();

    if (!activeSpaceId || !inviteForm.email.trim()) {
      return;
    }

    if (!isValidInviteEmail(inviteForm.email)) {
      setPageError(t("members.errors.invalidEmail"));
      return;
    }

    if (String(user?.email || "").toLowerCase() === normalizedInviteEmail) {
      setPageError(t("members.errors.selfInvite"));
      return;
    }

    if (inviteMatchesExistingMember) {
      setPageError(t("members.errors.alreadyMember"));
      return;
    }

    if (inviteMatchesPending) {
      setPageError(t("members.errors.alreadyInvited"));
      return;
    }

    setBusyAction("invite");
    setPageError("");
    setSuccessMessage("");

    try {
      await inviteMutation.mutateAsync({
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setInviteForm({ email: "", role: "MEMBER" });
      setSuccessMessage(t("members.labels.invitationQueued"));
    } catch (requestError) {
      setPageError(requestError.message || t("members.errors.inviteFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleRoleChange = async (member, nextRole) => {
    if (!activeSpaceId || !member?.user?.id) {
      return;
    }

    setBusyAction(`role-${member.user.id}`);
    setPageError("");
    setSuccessMessage("");

    try {
      await updateRoleMutation.mutateAsync({
        userId: member.user.id,
        role: nextRole,
      });
      setSuccessMessage(t("members.success.roleUpdated", { name: formatMemberName(member), role: formatRole(nextRole) }));
      await refreshApp?.();
    } catch (requestError) {
      setPageError(requestError.message || t("members.errors.roleFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleRemoveMember = async (member) => {
    if (!activeSpaceId || !member?.user?.id) {
      return;
    }

    if (!window.confirm(t("members.confirm.remove", { name: formatMemberName(member), workspace: activeSpace?.name || t("common.workspace") }))) {
      return;
    }

    setBusyAction(`remove-${member.user.id}`);
    setPageError("");
    setSuccessMessage("");

    try {
      await removeMemberMutation.mutateAsync(member.user.id);
      setSuccessMessage(t("members.success.memberRemoved", { name: formatMemberName(member) }));
      await refreshApp?.();
    } catch (requestError) {
      setPageError(requestError.message || t("members.errors.removeFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleRevokeInvitation = async (inviteId) => {
    if (!activeSpaceId || !inviteId) {
      return;
    }

    if (!window.confirm(t("members.confirm.revoke"))) {
      return;
    }

    setBusyAction(`invite-${inviteId}`);
    setPageError("");
    setSuccessMessage("");

    try {
      await revokeInvitationMutation.mutateAsync(inviteId);
      setSuccessMessage(t("members.labels.invitationRevoked"));
    } catch (requestError) {
      setPageError(requestError.message || t("members.errors.revokeFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!activeSpaceId) {
      return;
    }

    if (!window.confirm(t("members.confirm.leave", { workspace: activeSpace?.name || t("common.workspace") }))) {
      return;
    }

    setBusyAction("leave");
    setPageError("");
    setSuccessMessage("");

    try {
      await leaveWorkspaceMutation.mutateAsync();
      await refreshApp?.();
      window.location.href = "/spaces";
    } catch (requestError) {
      setPageError(requestError.message || t("members.errors.leaveFailed"));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId="members" />

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950" aria-label={t("members.title")} dir={isRTL ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className={`mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-sky-500">{t("members.eyebrow")}</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">{t("members.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {t("members.description", { workspace: activeSpace?.name || t("common.workspace") })}
              </p>
              {currentMembership ? (
                <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {t("members.yourRole", { role: formatRole(currentRole) })}
                </p>
              ) : null}
            </div>

            <div className={`flex flex-wrap gap-3 ${isRTL ? "justify-end" : ""}`}>
              {currentRole !== "OWNER" ? (
                <button
                  type="button"
                  onClick={handleLeaveWorkspace}
                  disabled={busyAction === "leave" || !activeSpaceId}
                  className="rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  {busyAction === "leave" ? t("members.leaving") : t("members.leaveWorkspace")}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || loadingInvitations}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {loading || loadingInvitations ? t("members.refreshing") : t("members.refresh")}
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard label={t("members.summary.members")} value={spaceMembers.length} hint={t("members.summary.membersHint")} />
            <SummaryCard
              label={t("members.summary.pendingInvites")}
              value={canViewInvitations ? invitations.length : "--"}
              hint={canViewInvitations ? t("members.summary.pendingInvitesHint") : t("members.summary.invitationRestricted")}
            />
            <SummaryCard
              label={t("members.summary.admins")}
              value={spaceMembers.filter((member) => ["OWNER", "ADMIN"].includes(String(getMemberRole(member)).toUpperCase())).length}
              hint={t("members.summary.adminsHint")}
            />
          </div>

          {error || pageError ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {pageError || error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("members.sections.currentMembers")}</h2>
              </div>

              {loading ? (
                <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</div>
              ) : spaceMembers.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {spaceMembers.map((member) => {
                    const role = String(getMemberRole(member)).toUpperCase();
                    const isSelf = member?.user?.id === user?.id;
                    const isOwner = role === "OWNER";
                    const canEditMember = canManageMembers && !isSelf && (currentRole === "OWNER" || !isOwner);
                    const isBusy = busyAction === `role-${member?.user?.id}` || busyAction === `remove-${member?.user?.id}`;

                    return (
                      <div key={member.id || member.userId || getMemberEmail(member)} className="flex flex-col gap-4 px-5 py-4">
                        <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sm font-black text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                              {formatMemberName(member).slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatMemberName(member)}</p>
                                {isSelf ? (
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                                    {t("members.labels.you")}
                                  </span>
                                ) : null}
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                  {formatMemberStatus(member)}
                                </span>
                              </div>
                              {getMemberEmail(member) ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getMemberEmail(member)}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className={`flex flex-wrap items-center gap-3 ${isRTL ? "justify-end" : ""}`}>
                            {canManageMembers ? (
                              <select
                                value={role}
                                disabled={!canEditMember || isBusy}
                                onChange={(event) => handleRoleChange(member, event.target.value)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                              >
                                {ROLE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {formatRole(option)}
                                  </option>
                                ))}
                                {role === "OWNER" ? <option value="OWNER">{t("members.roles.OWNER")}</option> : null}
                              </select>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                {formatRole(role)}
                              </span>
                            )}

                            {canEditMember ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member)}
                                disabled={isBusy}
                                className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                              >
                                {busyAction === `remove-${member?.user?.id}` ? t("members.labels.removing") : t("members.labels.remove")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("members.labels.noMembers")}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              {canManageMembers ? (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4">
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("members.sections.inviteTeammate")}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {t("members.sections.inviteDescription")}
                    </p>
                  </div>

                  <form onSubmit={handleInviteSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder={t("members.labels.emailPlaceholder")}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      required
                    />

                    <select
                      value={inviteForm.role}
                      onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatRole(option)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      disabled={busyAction === "invite" || !activeSpaceId}
                      className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "invite" ? t("members.labels.sendingInvite") : t("members.labels.sendInvite")}
                    </button>
                    {normalizedInviteEmail && !isValidInviteEmail(inviteForm.email) ? (
                      <p className="text-xs text-rose-600">{t("members.labels.validEmail")}</p>
                    ) : null}
                  </form>
                </section>
              ) : null}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("members.sections.pendingInvitations")}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("members.sections.pendingDescription")}
                  </p>
                </div>

                {!canViewInvitations ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t("members.labels.inviteRestricted")}
                  </div>
                ) : loadingInvitations ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t("common.loading")}</div>
                ) : invitations.length ? (
                  <div className="space-y-3">
                    {invitations.map((invite) => (
                      <div key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className={`flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-50">{invite.email}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {formatRole(invite.role)} | {t("members.labels.expires", { date: formatDate(invite.expiresAt) })}
                            </div>
                          </div>

                          {canManageMembers ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(invite.id)}
                              disabled={busyAction === `invite-${invite.id}`}
                              className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              {busyAction === `invite-${invite.id}` ? t("members.labels.revoking") : t("members.labels.revoke")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {t("members.labels.noInvites")}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
