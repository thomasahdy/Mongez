import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import NavBreadcrumb from "./NavBreadcrumb";
import { logout } from "../../services/api/authService";
import { useAppContext } from "../../pages/AppContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { resolveAvatarUrl } from "../../utils/avatarUrl";

const Navbar = ({ onToggleAI, onToggleSidebar, isSidebarOpen = true, path }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [focused, setFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef(null);
  const userMenuRef = useRef(null);
  const { user } = useAppContext();
  const userAvatarUrl = resolveAvatarUrl(user?.avatarUrl);

  const userInitials = useMemo(() => {
    const source = user?.name || user?.email || "User";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user?.email, user?.name]);

  // Ctrl+K global shortcut to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <header className="workspace-navbar top-header">
      <div className="flex items-center gap-3">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="action-btn px-2"
            aria-label={t(isSidebarOpen ? "layout.closeSidebar" : "layout.openSidebar")}
          >
            <i className={`fa-solid ${isSidebarOpen ? "fa-xmark" : "fa-bars"}`} />
          </button>
        ) : null}
        <NavBreadcrumb path={path} />
      </div>

      <div className="unified-search-bar" id="unifiedSearch">
        <div className="unified-search-wrapper" data-tour="global-search" data-focused={focused ? "true" : "false"}>
          <i className="fa-solid fa-magnifying-glass unified-search-icon" aria-hidden="true" />
          <i className="fa-solid fa-wand-magic-sparkles unified-ai-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            placeholder={t("layout.searchPlaceholder")}
            className="unified-search-input"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                setSearchValue('');
                setFocused(false);
              }
            }}
            aria-label={t("layout.searchAria")}
          />
          <span className="kbd-shortcut">{t("layout.shortcut")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="header-actions">
          <button type="button" className="action-btn" data-tour="ai-agents" onClick={onToggleAI}>
            <i className="fa-solid fa-robot" />
            <span>{t("layout.aiAgents")}</span>
            <span className="badge-new">{t("New")}</span>
          </button>
        </div>

        <button className="relative p-1.5" aria-label={t("layout.notifications")} type="button">
          <i className="fa-regular fa-bell bell-icon text-[17px] text-slate-400" />
          <span className="notification-dot" />
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((current) => !current)}
            className="avatar"
            aria-label={t("layout.userMenu")}
          >
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={t("settingsProfilePage.profileAvatar")} className="h-full w-full rounded-full object-cover" />
            ) : (
              userInitials
            )}
          </button>

          {showUserMenu ? (
            <div className={`absolute ${isRTL ? "left-0" : "right-0"} z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg`}>
              <NavLink
                to="/spaces"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowUserMenu(false)}
              >
                {t("layout.workspaceMenu")}
              </NavLink>
              <NavLink
                to="/settings/billing"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowUserMenu(false)}
              >
                {t("Billing")}
              </NavLink>
              <hr className="my-1 border-slate-200" />
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full px-4 py-2 text-sm text-red-600 hover:bg-slate-50 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("logout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
