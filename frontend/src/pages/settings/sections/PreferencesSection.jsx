import React from 'react'
import SettingsSection from '../../../components/settings/SettingsSection';
import ToggleRow from '../../../components/settings/ToggleRow';

const TOGGLE_DEFS = [
  {
    id:          "onlineStatus",
    title:       "Online Status",
    description: "Show other team members when you are active on the Mongez workspace.",
  },
  {
    id:          "weeklyDigest",
    title:       "Weekly Digest Email",
    description: "Receive a summary of your upcoming tasks and team activity every Monday morning.",
  },
  {
    id:          "focusModeReply",
    title:       "Focus Mode Auto-Reply",
    description: "Automatically mute notifications and set DnD when you enter active Focus Mode.",
  },
];


const PreferencesSection = ({ prefs, onToggle }) => {
  return (
    <SettingsSection title="Notification Preferences" icon="fa-solid fa-sliders" iconColor="text-emerald-500">
      {TOGGLE_DEFS.map((def, i) => (
        <ToggleRow
          key={def.id}
          id={def.id}
          title={def.title}
          description={def.description}
          checked={prefs[def.id]}
          onChange={(val) => onToggle(def.id, val)}
          isLast={i === TOGGLE_DEFS.length - 1}
        />
      ))}
    </SettingsSection>
  );
}

export default PreferencesSection
