import React, { useState } from 'react'
import NavBreadcrumb from './NavBreadcrumb';
import { authService } from '../../services/auth.service';

const Navbar = ({ onToggleAI, path }) => {
  const [focused, setFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    window.location.href = '/';
  };

  return (
    <header className="h-14 px-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 shrink-0">
      {/* Breadcrumb */}
      <NavBreadcrumb path={path}/>

      {/* Unified search */}
      <div className="flex-1 max-w-[480px]">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200
            ${focused
              ? "bg-white dark:bg-slate-800 border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
              : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
            }`}
        >
          <i className="fa-solid fa-magnifying-glass text-slate-400 text-[13px]" aria-hidden="true" />
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-[12px]" aria-hidden="true" />
          <input
            type="search"
            placeholder='Search or ask AI… "Why is Funding blocked?" • "overdue tasks"'
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search or ask AI"
          />
          <kbd className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded text-slate-400 font-mono">⌘K</kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Action buttons — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1.5">
          {[
            { icon: "fa-share-nodes", label: "Share" },
            { icon: "fa-robot",       label: "AI Agents", badge: "New" },
            { icon: "fa-bolt",        label: "Automate" },
          ].map(({ icon, label, badge }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-150 relative"
            >
              <i className={`fa-solid ${icon}`} />
              <span className="hidden lg:inline">{label}</span>
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] font-bold px-1.5 rounded-full uppercase leading-4">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bell */}
        <button className="relative p-1.5" aria-label="Notifications">
          <i className="fa-regular fa-bell text-slate-500 text-[17px]" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
        </button>

        {/* User avatar with menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-[11px] font-bold hover:ring-2 hover:ring-indigo-400 transition-all"
            aria-label="User menu"
          >
            TA
          </button>

          {/* User dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1">
              <a
                href="/settings"
                className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => setShowUserMenu(false)}
              >
                Settings
              </a>
              <hr className="my-1 border-slate-200 dark:border-slate-700" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* AI toggle */}
        <button
          onClick={onToggleAI}
          className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all duration-150"
          aria-label="Open AI Assistant"
        >
          <i className="fa-solid fa-robot text-[13px]" />
        </button>
      </div>
    </header>
  )
}




export default Navbar
