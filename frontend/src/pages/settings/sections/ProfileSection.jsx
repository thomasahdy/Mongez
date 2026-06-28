import FormField from "../../../components/ui/FormField";
import SettingsSection from "../../../components/settings/SettingsSection";
import AvatarUpload from "../../../components/settings/AvatarUpload";

const ProfileSection = ({ form, onChange, onAvatarUploadAttempt }) => {
  const initials = `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`.trim() || "M";

  return (
    <SettingsSection title="Profile" icon="fa-regular fa-id-badge" iconColor="text-sky-500">
      <AvatarUpload
        initials={initials.toUpperCase()}
        src={form.avatarUrl}
        onFileSelect={onAvatarUploadAttempt}
        onRemove={onAvatarUploadAttempt}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First Name"
          type="text"
          value={form.firstName}
          onChange={(event) => onChange("firstName", event.target.value)}
          autoComplete="given-name"
        />
        <FormField
          id="lastName"
          label="Last Name"
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
