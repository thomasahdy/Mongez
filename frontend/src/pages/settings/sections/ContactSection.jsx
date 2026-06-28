import SettingsSection from "../../../components/settings/SettingsSection";
import FormField from "../../../components/ui/FormField";
import { useTranslation } from "react-i18next";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Africa/Cairo", label: "Africa/Cairo" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
];

const ContactSection = ({ form, onChange }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("settingsProfilePage.accountContact")} icon="fa-regular fa-envelope" iconColor="text-indigo-500">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="email"
          label={t("settingsProfilePage.emailAddress")}
          type="email"
          value={form.email}
          readOnly
          className="sm:col-span-2"
          autoComplete="email"
        />
        <FormField
          id="timezone"
          label={t("settingsProfilePage.timezone")}
          as="select"
          value={form.timezone}
          onChange={(event) => onChange("timezone", event.target.value)}
        >
          {TIMEZONES.map((timezone) => (
            <option key={timezone.value} value={timezone.value}>
              {timezone.label}
            </option>
          ))}
        </FormField>
      </div>
    </SettingsSection>
  );
};

export default ContactSection;
