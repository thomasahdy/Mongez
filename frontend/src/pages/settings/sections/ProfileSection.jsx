import FormField from "../../../components/ui/FormField";
import SettingsSection from "../../../components/settings/SettingsSection";
import AvatarUpload from "../../../components/settings/AvatarUpload";
import { useTranslation } from "react-i18next";

const ProfileSection = ({ form, onChange, onAvatarUploadAttempt }) => {
  const { t } = useTranslation();
  const initials = `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`.trim() || "M";

  return (
    <SettingsSection title={t("settingsProfilePage.profile")} icon="fa-regular fa-id-badge" iconColor="text-sky-500">
      <AvatarUpload
        initials={initials.toUpperCase()}
        src={form.avatarUrl}
        onFileSelect={onAvatarUploadAttempt}
        onRemove={onAvatarUploadAttempt}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="firstName"
          label={t("settingsProfilePage.firstName")}
          type="text"
          value={form.firstName}
          onChange={(event) => onChange("firstName", event.target.value)}
          autoComplete="given-name"
        />
        <FormField
          id="lastName"
          label={t("settingsProfilePage.lastName")}
          type="text"
          value={form.lastName}
          onChange={(event) => onChange("lastName", event.target.value)}
          autoComplete="family-name"
        />
      </div>
    </SettingsSection>
  );
};

export default ProfileSection;
