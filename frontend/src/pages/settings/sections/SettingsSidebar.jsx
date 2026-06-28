import React from "react";
import { NavLink } from "react-router";


const SETTINGS_NAV = {
  personal: [
    { id: "profile",       href: "/settings",              icon: "fa-regular fa-user",           label: "My Profile" },
    { id: "notifications", href: "/settings/notifications", icon: "fa-regular fa-bell",           label: "Notifications" },
    { id: "security",      href: "/settings/security",      icon: "fa-solid fa-shield-halved",    label: "Security" },
  ],
  workspace: [
    { id: "members",       href: "/settings/members",       icon: "fa-solid fa-users",            label: "Members & Roles" },
    { id: "billing",       href: "/settings/billing",       icon: "fa-solid fa-credit-card",      label: "Billing" },
    { id: "integrations",  href: "/settings/integrations",  icon: "fa-solid fa-plug",             label: "Integrations" },
    { id: "reports",       href: "/reports",                icon: "fa-solid fa-chart-line",       label: "Reports" },
    { id: "audit",         href: "/settings/audit-log",     icon: "fa-solid fa-clock-rotate-left",label: "Audit Log" },
  ],
};

const SettingsSidebar = ({ activeId = "profile" }) => {
  return (
    <nav className="settings-sidebar" aria-label="Settings navigation">
      <div>
        <div className="settings-group-title">
          Personal Settings
        </div>
        <div className="settings-nav">
          {SETTINGS_NAV.personal.map((item) => (
            <SettingsSidebarItem key={item.id} item={item} active={activeId === item.id} />
          ))}
        </div>
      </div>

      <div>
        <div className="settings-group-title">
          Workspace
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
}

export default SettingsSidebar

function SettingsSidebarItem({ item, active }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) => `settings-nav-item ${active || isActive ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <i className={item.icon} aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}
