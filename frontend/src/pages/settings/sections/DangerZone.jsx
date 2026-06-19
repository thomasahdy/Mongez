import React, { useState } from 'react'
import SettingsSection from '../../../components/settings/SettingsSection';
import Button from '../../../components/ui/Button';

const DangerZone = ({ onDeleteAccount }) => {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (confirming) {
      onDeleteAccount?.();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <SettingsSection title="Danger Zone" icon="fa-solid fa-triangle-exclamation" danger>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Delete Account</p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirming && (
            <Button variant="outline" size="md" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          )}
          <Button variant="danger-ghost" size="md" onClick={handleDelete}>
            {confirming ? "Confirm Delete" : "Delete Account"}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}

export default DangerZone
