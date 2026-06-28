import Button from "../../../components/ui/Button";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const StickyFooter = ({
  onDiscard,
  onSave,
  hasChanges,
  discardDisabled = false,
  saveDisabled = false,
  saveLabel,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <div
      className="sticky bottom-0 z-10 mt-2 -mx-6 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/90"
      role="group"
      aria-label={t("stickyFooter.groupAria")}
    >
      <Button variant="outline" size="md" onClick={onDiscard} className="min-w-[80px]" disabled={discardDisabled}>
        {t("stickyFooter.discard")}
      </Button>
      <Button variant="primary" size="md" onClick={onSave} disabled={saveDisabled}>
        <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
        {saveLabel || t("common.save")}
        {hasChanges && !saveDisabled ? (
          <span className={`${isRTL ? "mr-0.5" : "ml-0.5"} h-2 w-2 shrink-0 rounded-full bg-amber-400`} aria-label={t("stickyFooter.unsavedChanges")} />
        ) : null}
      </Button>
    </div>
  );
};

export default StickyFooter;
