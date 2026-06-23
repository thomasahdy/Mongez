import SettingsSection from "../../../components/settings/SettingsSection";
import FormField from "../../../components/ui/FormField";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
];

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const WEEK_START_OPTIONS = [
  { value: "MON", label: "Monday" },
  { value: "SUN", label: "Sunday" },
  { value: "SAT", label: "Saturday" },
];

const PreferencesSection = ({ form, onChange }) => {
  return (
    <SettingsSection title="Preferences" icon="fa-solid fa-sliders" iconColor="text-emerald-500">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="language"
          label="Language"
          as="select"
          value={form.language}
          onChange={(event) => onChange("language", event.target.value)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>

        <FormField
          id="theme"
          label="Theme"
          as="select"
          value={form.theme}
          onChange={(event) => onChange("theme", event.target.value)}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>

        <FormField
          id="dateFormat"
          label="Date Format"
          as="select"
          value={form.dateFormat}
          onChange={(event) => onChange("dateFormat", event.target.value)}
        >
          {DATE_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>

        <FormField
          id="weekStart"
          label="Week Starts On"
          as="select"
          value={form.weekStart}
          onChange={(event) => onChange("weekStart", event.target.value)}
        >
          {WEEK_START_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>
      </div>
    </SettingsSection>
  );
};

export default PreferencesSection;
