import Button from "../../../components/ui/Button";

const StickyFooter = ({
  onDiscard,
  onSave,
  hasChanges,
  discardDisabled = false,
  saveDisabled = false,
  saveLabel = "Save Changes",
}) => {
  return (
    <div
      className="sticky bottom-0 z-10 mt-2 -mx-6 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/90"
      role="group"
      aria-label="Save or discard changes"
    >
      <Button variant="outline" size="md" onClick={onDiscard} className="min-w-[80px]" disabled={discardDisabled}>
        Discard
      </Button>
      <Button variant="primary" size="md" onClick={onSave} disabled={saveDisabled}>
        <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
        {saveLabel}
        {hasChanges && !saveDisabled ? (
          <span className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
        ) : null}
      </Button>
    </div>
  );
};

export default StickyFooter;
