import React from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

const SETTINGS_NAV = {
  personal: [
    { id: "profile", href: "/settings", icon: "fa-regular fa-user", key: "profile" },
    { id: "notifications", href: "/settings/notifications", icon: "fa-regular fa-bell", key: "notifications" },
    { id: "security", href: "/settings/security", icon: "fa-solid fa-shield-halved", key: "security" },
  ],
  workspace: [
    { id: "members", href: "/settings/members", icon: "fa-solid fa-users", key: "members" },
    { id: "billing", href: "/billing", icon: "fa-solid fa-credit-card", key: "billing" },
    { id: "integrations", href: "/settings/integrations", icon: "fa-solid fa-plug", key: "integrations" },
    { id: "reports", href: "/reports", icon: "fa-solid fa-chart-line", key: "reports" },
    { id: "audit", href: "/settings/audit-log", icon: "fa-solid fa-clock-rotate-left", key: "audit" },
  ],
};

const SettingsSidebar = ({ activeId = "profile" }) => {
  const { t } = useTranslation();

  return (
    <nav
      className="w-[240px] shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-4 py-6 flex flex-col gap-6 overflow-y-auto"
      aria-label={t("settingsSidebar.aria")}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-3">
          {t("settingsSidebar.personal")}
        </p>
        <div className="flex flex-col gap-0.5">
          {SETTINGS_NAV.personal.map((item) => (
            <SettingsSidebarItem key={item.id} item={item} active={activeId === item.id} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-3 flex items-center gap-2">
          {t("settingsSidebar.workspace")}
          <span className="text-[9px] font-bold uppercase bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded">
            {t("settingsSidebar.pro")}
          </span>
        </p>
        <div className="flex flex-col gap-0.5">
          {SETTINGS_NAV.workspace.map((item) => (
            <SettingsSidebarItem key={item.id} item={item} active={activeId === item.id} />
          ))}
        </div>
      </div>
    </nav>
  );
};

export default SettingsSidebar

function SettingsSidebarItem({ item, active }) {
  const { t } = useTranslation();

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150
        ${active
          ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-semibold"
          : isActive
            ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
        }`}
      aria-current={active ? "page" : undefined}
    >
      <i className={`${item.icon} text-[13px] w-4 text-center`} aria-hidden="true" />
      {t(`settingsSidebar.items.${item.key}`)}
    </NavLink>
  );
}
