import React from 'react'

const SettingsSection = ({ title, icon, iconColor = "text-sky-500", danger = false, children }) => {
  return (
      <section
        className={`rounded-xl border p-6 shadow-sm mb-6 ${
          danger
            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        }`}
        aria-label={title}
      >
        <h2
          className={`flex items-center gap-2 text-[15px] font-semibold mb-5 ${
            danger ? "text-red-500" : "text-slate-800 dark:text-slate-100"
          }`}
        >
          <i className={`${icon} text-[14px] ${danger ? "text-red-500" : iconColor}`} aria-hidden="true" />
          {title}
        </h2>
        {children}
      </section>
    );
}

export default SettingsSection
