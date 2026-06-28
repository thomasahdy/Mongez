import SettingsSection from "../../../components/settings/SettingsSection";
import FormField from "../../../components/ui/FormField";
import { useTranslation } from "react-i18next";

const LANGUAGE_OPTIONS = [
  { value: "en", labelKey: "settingsProfilePage.english" },
  { value: "ar", labelKey: "settingsProfilePage.arabic" },
];

const THEME_OPTIONS = [
  { value: "system", labelKey: "settingsProfilePage.system" },
  { value: "light", labelKey: "settingsProfilePage.light" },
  { value: "dark", labelKey: "settingsProfilePage.dark" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const WEEK_START_OPTIONS = [
  { value: "MON", labelKey: "settingsProfilePage.monday" },
  { value: "SUN", labelKey: "settingsProfilePage.sunday" },
  { value: "SAT", labelKey: "settingsProfilePage.saturday" },
];

const PreferencesSection = ({ form, onChange }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("settingsProfilePage.preferences")} icon="fa-solid fa-sliders" iconColor="text-emerald-500">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          id="language"
          label={t("settingsProfilePage.language")}
          as="select"
          value={form.language}
          onChange={(event) => onChange("language", event.target.value)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </FormField>

        <FormField
          id="theme"
          label={t("settingsProfilePage.theme")}
          as="select"
          value={form.theme}
          onChange={(event) => onChange("theme", event.target.value)}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </FormField>

        <FormField
          id="dateFormat"
          label={t("settingsProfilePage.dateFormat")}
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
          label={t("settingsProfilePage.weekStartsOn")}
          as="select"
          value={form.weekStart}
          onChange={(event) => onChange("weekStart", event.target.value)}
        >
          {WEEK_START_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </FormField>
      </div>
    </SettingsSection>
  );
};

export default PreferencesSection;
