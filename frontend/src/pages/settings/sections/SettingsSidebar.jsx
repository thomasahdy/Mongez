import React from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const SETTINGS_NAV = {
  personal: [
    { id: "profile", href: "/settings", icon: "fa-regular fa-user", key: "profile" },
    { id: "notifications", href: "/settings/notifications", icon: "fa-regular fa-bell", key: "notifications" },
    { id: "security", href: "/settings/security", icon: "fa-solid fa-shield-halved", key: "security" },
  ],
  workspace: [
    { id: "members", href: "/settings/members", icon: "fa-solid fa-users", labelKey: "members.breadcrumb" },
    { id: "billing", href: "/settings/billing", icon: "fa-solid fa-credit-card", labelKey: "Billing" },
    { id: "integrations", href: "/settings/integrations", icon: "fa-solid fa-plug", labelKey: "integrations.title" },
    { id: "reports", href: "/reports", icon: "fa-solid fa-chart-line", labelKey: "Reports" },
    { id: "audit", href: "/settings/audit-log", icon: "fa-solid fa-clock-rotate-left", labelKey: "auditLogPage.title" },
  ],
};

const SettingsSidebar = ({ activeId = "profile" }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <nav className={`settings-sidebar ${isRTL ? "text-right" : "text-left"}`} aria-label={t("settingsProfilePage.breadcrumbSettings")} dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <div className="settings-group-title">
          {t("settingsProfilePage.breadcrumbSettings")}
        </div>
        <div className="settings-nav">
          {SETTINGS_NAV.personal.map((item) => (
            <SettingsSidebarItem key={item.id} item={item} active={activeId === item.id} />
          ))}
        </div>
      </div>

      <div>
        <div className="settings-group-title">
          {t("common.workspace")}
          <span className="pro-badge">PRO</span>
        </div>
        <div className="settings-nav">
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
  const label = item.labelKey ? t(item.labelKey) : t(`settingsSidebar.${item.key}`);

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) => `settings-nav-item ${active || isActive ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <i className={item.icon} aria-hidden="true" />
      {label}
    </NavLink>
  );
}
