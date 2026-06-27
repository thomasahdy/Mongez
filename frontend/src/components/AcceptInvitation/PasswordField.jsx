import React, { useState } from 'react'

const PasswordField = ({ id, label, placeholder, value, onChange, required }) => {
  const [visible, setVisible] = useState(false);
   
    return (
      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            autoComplete="new-password"
            className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-600 rounded-lg text-[13px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 placeholder:text-slate-400 transition-all duration-150 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            <i className={`fa-solid ${visible ? "fa-eye-slash" : "fa-eye"} text-[13px]`} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
}

export default PasswordField
