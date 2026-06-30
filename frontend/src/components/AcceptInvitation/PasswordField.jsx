import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const PasswordField = ({ id, label, placeholder, value, onChange, required }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`flex flex-col gap-1.5 ${isRTL ? "text-right" : "text-left"}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          autoComplete="new-password"
          className={`w-full rounded-lg border border-slate-200 bg-white py-2.5 text-[13px] text-slate-800 text-start outline-none transition-all duration-150 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-sky-900/30 ${
            isRTL ? "pl-10 pr-3.5" : "pr-10 pl-3.5"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300 ${
            isRTL ? "left-3" : "right-3"
          }`}
          aria-label={visible ? t("acceptInvitation.hidePassword") : t("acceptInvitation.showPassword")}
        >
          <i className={`fa-solid ${visible ? "fa-eye-slash" : "fa-eye"} text-[13px]`} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default PasswordField;
