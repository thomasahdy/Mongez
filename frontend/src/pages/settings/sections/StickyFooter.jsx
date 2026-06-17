import React from 'react'
import Button from '../../../components/ui/Button';

const StickyFooter = ({ onDiscard, onSave, hasChanges }) => {
  return (
    <div
      className="sticky bottom-0 -mx-6 px-6 py-4 mt-2 flex justify-end gap-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] z-10"
      role="group"
      aria-label="Save or discard changes"
    >
      <Button variant="outline" size="md" onClick={onDiscard} className="min-w-[80px]">
        Discard
      </Button>
      <Button variant="primary" size="md" onClick={onSave}>
        <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
        Save Changes
        {hasChanges && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-0.5" aria-label="Unsaved changes" />
        )}
      </Button>
    </div>
  );
}

export default StickyFooter
