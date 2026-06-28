import React from 'react'

const FormField = ({ id, label, type = "text", placeholder, value, onChange, required, autoComplete }) => {
  return (
      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[13px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 placeholder:text-slate-400 transition-all duration-150 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30"
        />
      </div>
    );
}

export default FormField
