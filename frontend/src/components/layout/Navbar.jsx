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
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 text-slate-950 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <div className="flex items-center gap-3">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label={t(isSidebarOpen ? "layout.closeSidebar" : "layout.openSidebar")}
          >
            <i className={`fa-solid ${isSidebarOpen ? "fa-xmark" : "fa-bars"}`} />
          </button>
        ) : null}
        <NavBreadcrumb path={path} />
      </div>

      <div className="mx-4 max-w-xl flex-1" id="unifiedSearch">
        <div 
          className={`relative flex items-center rounded-lg border px-3 py-1.5 transition-all ${
            focused 
              ? "border-blue-500 ring-2 ring-blue-500/20" 
              : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
          }`}
          data-tour="global-search" 
          data-focused={focused ? "true" : "false"}
        >
          <i className="fa-solid fa-magnifying-glass text-slate-400 mr-2 dark:text-slate-500" aria-hidden="true" />
          <i className="fa-solid fa-wand-magic-sparkles text-purple-400 mr-2 opacity-50" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            placeholder={t("layout.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
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
          <span className="ml-2 hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm md:block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
            {t("layout.shortcut")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="header-actions">
          <button 
            type="button" 
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" 
            data-tour="ai-agents" 
            onClick={onToggleAI}
          >
            <i className="fa-solid fa-robot text-blue-500" />
            <span>{t("layout.aiAgents")}</span>
            <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {t("New")}
            </span>
          </button>
        </div>

        <button className="relative rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300" aria-label={t("layout.notifications")} type="button">
          <i className="fa-regular fa-bell text-[17px]" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 hover:ring-2 hover:ring-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:ring-slate-600"
            aria-label={t("layout.userMenu")}
          >
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={t("settingsProfilePage.profileAvatar")} className="h-full w-full rounded-full object-cover" />
            ) : (
              userInitials
            )}
          </button>

          {showUserMenu ? (
            <div className={`absolute ${isRTL ? "left-0" : "right-0"} z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800`}>
              <NavLink
                to="/spaces"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setShowUserMenu(false)}
              >
                {t("layout.workspaceMenu")}
              </NavLink>
              <NavLink
                to="/settings/billing"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setShowUserMenu(false)}
              >
                {t("Billing")}
              </NavLink>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full px-4 py-2 text-sm text-red-400 hover:text-red-500 dark:hover:bg-red-900/20 ${isRTL ? "text-right" : "text-left"}`}
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