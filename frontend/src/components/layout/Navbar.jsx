import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import NavBreadcrumb from "./NavBreadcrumb";
import { logout } from "../../services/api/authService";
import { useAppContext } from "../../pages/AppContext";

const Navbar = ({ onToggleAI, onToggleSidebar, path }) => {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef(null);
  const userMenuRef = useRef(null);
  const { user } = useAppContext();

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
    window.location.href = "/";
  };

  return (
    <header className="workspace-navbar top-header">
      <div className="flex items-center gap-3">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="action-btn px-2 lg:hidden"
            aria-label="Open sidebar"
          >
            <i className="fa-solid fa-bars" />
          </button>
        ) : null}
        <NavBreadcrumb path={path} />
      </div>

      <div className="unified-search-bar" id="unifiedSearch">
        <div className="unified-search-wrapper" data-focused={focused ? "true" : "false"}>
          <i className="fa-solid fa-magnifying-glass unified-search-icon" aria-hidden="true" />
          <i className="fa-solid fa-wand-magic-sparkles unified-ai-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            placeholder='Search or ask AI... "Show KPI summary" | "budget status"'
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
            aria-label="Search or ask AI"
          />
          <span className="kbd-shortcut">Ctrl K</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="header-actions">
          <button type="button" className="action-btn" onClick={onToggleAI}>
            <i className="fa-solid fa-robot" />
            <span>AI Agents</span>
            <span className="badge-new">New</span>
          </button>
        </div>

        <button className="relative p-1.5" aria-label="Notifications" type="button">
          <i className="fa-regular fa-bell bell-icon text-[17px] text-slate-400" />
          <span className="notification-dot" />
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((current) => !current)}
            className="avatar"
            aria-label="User menu"
          >
            {userInitials}
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <NavLink
                to="/spaces"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowUserMenu(false)}
              >
                Workspace
              </NavLink>
              <NavLink
                to="/settings/billing"
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowUserMenu(false)}
              >
                Billing
              </NavLink>
              <hr className="my-1 border-slate-200" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
