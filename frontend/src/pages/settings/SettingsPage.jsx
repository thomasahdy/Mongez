import { useState, useRef, useCallback, useEffect } from "react";
import Button from '../../components/ui/Button'
import SettingsSidebar from "./sections/SettingsSidebar";
import StickyFooter from "./sections/StickyFooter";
import DangerZone from "./sections/DangerZone";
import SettingsSection from "../../components/settings/SettingsSection";
import ProfileSection from "./sections/ProfileSection";
import FormField from "../../components/ui/FormField";
import ContactSection from "./sections/ContactSection";
import PreferencesSection from "./sections/PreferencesSection";

// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────



const INITIAL_FORM = {
  firstName: "Alsherif",
  lastName:  "Ashraf",
  jobTitle:  "Product Manager",
  bio:       "",
  email:     "Alsherif@mongez.com",
  phone:     "",
  timezone:  "Central European Time (CET)",
};

const INITIAL_PREFS = {
  onlineStatus:   true,
  weeklyDigest:   true,
  focusModeReply: false,
};



let path=[
  {
    name:"Al-Noor Foundation",
    color:"text-slate-400",
    ref:""
  },
  {
    name:"Settings",
    color:"text-slate-800",
    ref:""
  },
  
]


export default function SettingsPage({ onSave, onDeleteAccount, setPath }) {
  const [form,    setForm]    = useState(INITIAL_FORM);
  const [prefs,   setPrefs]   = useState(INITIAL_PREFS);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(()=>{
    setPath(path);
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const handleToggle = useCallback((id, value) => {
    setPrefs((prev) => ({ ...prev, [id]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave?.({ form, prefs });
    setIsDirty(false);
  }, [form, prefs, onSave]);

  const handleDiscard = useCallback(() => {
    setForm(INITIAL_FORM);
    setPrefs(INITIAL_PREFS);
    setIsDirty(false);
  }, []);

  return (
    
          <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar activeId="profile" />

            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900" aria-label="Profile settings">
              <div className="px-6 py-6 max-w-[700px] mx-auto">
                <div className="mb-8">
                  <h1 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-1.5">
                    My Profile
                  </h1>
                  <p className="text-[14px] text-slate-500 dark:text-slate-400">
                    Manage your personal information, avatar, and contact details.
                  </p>
                </div>

                <ProfileSection     form={form}  onChange={handleFormChange} />
                <ContactSection     form={form}  onChange={handleFormChange} />
                <PreferencesSection prefs={prefs} onToggle={handleToggle} />
                <DangerZone onDeleteAccount={onDeleteAccount} />

                <StickyFooter
                  onDiscard={handleDiscard}
                  onSave={handleSave}
                  hasChanges={isDirty}
                />
              </div>
            </main>
            
          </div>
  );
}