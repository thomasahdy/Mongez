import React from 'react'
import FormField from '../../../components/ui/FormField';
import SettingsSection from '../../../components/settings/SettingsSection';
import AvatarUpload from '../../../components/settings/AvatarUpload';

const ProfileSection = ({ form, onChange }) => {
  return (
    <SettingsSection title="Public Profile" icon="fa-regular fa-id-badge" iconColor="text-sky-500">
      <AvatarUpload
        initials=""
        onFileSelect={(file) => console.info("Avatar file:", file.name)}
        onRemove={() => console.info("Remove avatar")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField id="firstName" label="First Name" type="text" value={form.firstName}
          onChange={(e) => onChange("firstName", e.target.value)} autoComplete="given-name" />
        <FormField id="lastName"  label="Last Name"  type="text" value={form.lastName}
          onChange={(e) => onChange("lastName",  e.target.value)} autoComplete="family-name" />
        <FormField id="jobTitle"  label="Job Title"  type="text" value={form.jobTitle}
          onChange={(e) => onChange("jobTitle",  e.target.value)} className="sm:col-span-2" />
        <FormField id="bio" label="Bio (Optional)" as="textarea" value={form.bio}
          onChange={(e) => onChange("bio", e.target.value)}
          placeholder="Write a short description about yourself..."
          className="sm:col-span-2" />
      </div>
    </SettingsSection>
  );
}

export default ProfileSection
