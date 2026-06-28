import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import SettingsSidebar from "./sections/SettingsSidebar";
import StickyFooter from "./sections/StickyFooter";
import DangerZone from "./sections/DangerZone";
import ProfileSection from "./sections/ProfileSection";
import ContactSection from "./sections/ContactSection";
import PreferencesSection from "./sections/PreferencesSection";
import {
  useSettingsProfileQuery,
  useUpdatePreferencesMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "../../hooks/useSettingsQueries";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  timezone: "UTC",
  language: "en",
  theme: "system",
  dateFormat: "DD/MM/YYYY",
  weekStart: "MON",
  avatarUrl: "",
};

const settingsPath = [
  { name: "Settings", color: "text-slate-400", ref: "/settings" },
  { name: "My Profile", color: "text-slate-800", ref: "/settings" },
];

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function buildFormState(profile, preferences) {
  const { firstName, lastName } = splitName(profile?.name || profile?.fullName);

  return {
    firstName,
    lastName,
    email: profile?.email || "",
    timezone: preferences?.timezone || "UTC",
    language: preferences?.language || profile?.language || "en",
    theme: preferences?.theme || "system",
    dateFormat: preferences?.dateFormat || "DD/MM/YYYY",
    weekStart: preferences?.weekStart || "MON",
    avatarUrl: profile?.avatarUrl || "",
  };
}

function haveDifferentValues(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

export default function SettingsPage({ setPath }) {
  const sessionUser = useSelector((state) => state.users?.user || null);
  const settingsQuery = useSettingsProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const updatePreferencesMutation = useUpdatePreferencesMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setPath?.(settingsPath);
  }, [setPath]);

  const serverForm = useMemo(() => {
    if (!settingsQuery.data) {
      return INITIAL_FORM;
    }

    return buildFormState(settingsQuery.data.profile, settingsQuery.data.preferences);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(serverForm);
    }
  }, [serverForm, settingsQuery.data]);

  const isSaving = updateProfileMutation.isPending || updatePreferencesMutation.isPending;
  const isDirty = haveDifferentValues(form, serverForm);
  const displayName = `${form.firstName} ${form.lastName}`.trim() || sessionUser?.name || sessionUser?.fullName || "Profile";

  useEffect(() => {
    if (settingsQuery.isError) {
      setPageError(settingsQuery.error?.message || "Unable to load your settings.");
    }
  }, [settingsQuery.error?.message, settingsQuery.isError]);

  const handleFieldChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setPageError("");
    setSuccessMessage("");
  };

  const handleAvatarUploadAttempt = async (fileOrEvent) => {
    if (!fileOrEvent || fileOrEvent.target) {
      // Remove avatar
      try {
        setPageError("");
        setSuccessMessage("");
        await updateProfileMutation.mutateAsync({ avatarUrl: "" });
        setSuccessMessage("Avatar removed successfully.");
      } catch (error) {
        setPageError(error.message || "Failed to remove avatar.");
      }
      return;
    }

    // Upload avatar
    try {
      setPageError("");
      setSuccessMessage("");
      await uploadAvatarMutation.mutateAsync(fileOrEvent);
      setSuccessMessage("Avatar uploaded successfully.");
    } catch (error) {
      setPageError(error.message || "Failed to upload avatar.");
    }
  };

  const handleDiscard = () => {
    setForm(serverForm);
    setPageError("");
    setSuccessMessage("");
  };

  const handleSave = async () => {
    const trimmedName = `${form.firstName} ${form.lastName}`.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setPageError("Enter at least a first and last name before saving.");
      return;
    }

    const profilePayload = {};
    const preferencesPayload = {};

    if (trimmedName !== `${serverForm.firstName} ${serverForm.lastName}`.trim()) {
      profilePayload.name = trimmedName;
    }

    if (form.language !== serverForm.language) {
      preferencesPayload.language = form.language;
    }

    if (form.timezone !== serverForm.timezone) {
      preferencesPayload.timezone = form.timezone;
    }

    if (form.theme !== serverForm.theme) {
      preferencesPayload.theme = form.theme;
    }

    if (form.dateFormat !== serverForm.dateFormat) {
      preferencesPayload.dateFormat = form.dateFormat;
    }

    if (form.weekStart !== serverForm.weekStart) {
      preferencesPayload.weekStart = form.weekStart;
    }

    if (!Object.keys(profilePayload).length && !Object.keys(preferencesPayload).length) {
      setSuccessMessage("Your settings are already up to date.");
      return;
    }

    setPageError("");
    setSuccessMessage("");

    try {
      await Promise.all([
        Object.keys(profilePayload).length ? updateProfileMutation.mutateAsync(profilePayload) : Promise.resolve(null),
        Object.keys(preferencesPayload).length ? updatePreferencesMutation.mutateAsync(preferencesPayload) : Promise.resolve(null),
      ]);
      await settingsQuery.refetch();
      setSuccessMessage("Profile and preferences saved.");
    } catch (error) {
      setPageError(error.message || "Unable to save your settings.");
    }
  };

  if (settingsQuery.isLoading && !settingsQuery.data) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar activeId="profile" />
        <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          Loading your profile settings...
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId="profile" />

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900" aria-label="Profile settings">
        <div className="mx-auto max-w-[760px] px-6 py-6">
          <div className="mb-8">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-slate-50">My Profile</h1>
            <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
              Manage the profile and personal preferences currently supported by the live user API.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
              Signed in as <span className="text-slate-600 dark:text-slate-300">{displayName}</span>
            </p>
          </div>

          {pageError ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {pageError}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <ProfileSection
            form={form}
            onChange={handleFieldChange}
            onAvatarUploadAttempt={handleAvatarUploadAttempt}
          />
          <ContactSection form={form} onChange={handleFieldChange} />
          <PreferencesSection form={form} onChange={handleFieldChange} />
          <DangerZone
            title="Account Actions"
            description="Account deletion is not exposed by the current API contract yet, so this section stays read-only for now."
            actionLabel="Deletion Unavailable"
            disabled
          />

          <StickyFooter
            onDiscard={handleDiscard}
            onSave={handleSave}
            hasChanges={isDirty}
            discardDisabled={!isDirty || isSaving}
            saveDisabled={!isDirty || isSaving}
            saveLabel={isSaving ? "Saving..." : "Save Changes"}
          />
        </div>
      </main>
    </div>
  );
}
