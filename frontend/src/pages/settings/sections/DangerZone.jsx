import SettingsSection from "../../../components/settings/SettingsSection";
import Button from "../../../components/ui/Button";

const DangerZone = ({
  title = "Danger Zone",
  description = "This action cannot be undone.",
  actionLabel = "Delete Account",
  disabled = false,
  onDeleteAccount,
}) => {
  return (
    <SettingsSection title={title} icon="fa-solid fa-triangle-exclamation" danger>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-[14px] font-semibold text-slate-800 dark:text-slate-100">{actionLabel}</p>
          <p className="max-w-lg text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>

        <Button
          variant="ghost"
          size="md"
          onClick={onDeleteAccount}
          disabled={disabled}
          className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
        >
          {actionLabel}
        </Button>
      </div>
    </SettingsSection>
  );
};

export default DangerZone;
