import { useEffect } from "react";
import SettingsSidebar from "./sections/SettingsSidebar";

const copy = {
  notifications: {
    title: "Notifications",
    description: "Notification preferences need a dedicated backend-backed settings contract before this form can save real values.",
    icon: "fa-regular fa-bell",
  },
  security: {
    title: "Security",
    description: "Security controls need a dedicated backend-backed settings contract before this section can expose editable controls.",
    icon: "fa-solid fa-shield-halved",
  },
};

export default function SettingsPlaceholderPage({ setPath, activeId = "notifications" }) {
  const section = copy[activeId] || copy.notifications;

  useEffect(() => {
    setPath?.([
      { name: "Settings", color: "text-slate-400", ref: "/settings" },
      { name: section.title, color: "text-slate-800", ref: `/settings/${activeId}` },
    ]);
  }, [activeId, section.title, setPath]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSidebar activeId={activeId} />
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950" aria-label={`${section.title} settings`}>
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-xl text-sky-500 dark:bg-sky-500/10">
              <i className={section.icon} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">{section.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{section.description}</p>
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              No dummy settings are shown here. Once the API contract exists, this route can be connected without changing navigation.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
