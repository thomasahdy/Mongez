import React from 'react'
import SettingsSection from '../../../components/settings/SettingsSection';
import FormField from '../../../components/ui/FormField';


const TIMEZONES = [
  "Pacific Time (PT)",
  "Eastern Time (ET)",
  "Central European Time (CET)",
  "Gulf Standard Time (GST)",
];

const ContactSection = ({ form, onChange }) => {
  return (
    <SettingsSection title="Contact Information" icon="fa-regular fa-envelope" iconColor="text-indigo-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField id="email" label="Email Address" type="email" value={form.email}
          onChange={(e) => onChange("email", e.target.value)} className="sm:col-span-2"
          autoComplete="email" />
        <FormField id="phone" label="Phone Number" type="tel" value={form.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="+1 (555) 000-0000" autoComplete="tel" />
        <FormField id="timezone" label="Timezone" as="select" value={form.timezone}
          onChange={(e) => onChange("timezone", e.target.value)}>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </FormField>
      </div>
    </SettingsSection>
  );
}

export default ContactSection
