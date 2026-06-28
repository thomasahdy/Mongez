import Badge from "../ui/Badge";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const NavItem = ({ href, icon, iconColor, label, badge, kbd, aiBadge, active, disabled, onClick }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const className = `flex items-center gap-2 rounded-lg px-2 py-[7px] text-[13px] font-medium transition-all duration-150
    ${
      active
        ? "bg-sky-100 font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    }
    ${disabled ? "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent" : "cursor-pointer"}`;

  const trailingClass = isRTL ? "mr-auto" : "ml-auto";

  const content = (
    <>
      <span className="flex w-5 justify-center text-[13px]" style={iconColor ? { color: iconColor } : {}}>
        <i className={`${icon?.startsWith("fa-regular") ? "" : "fa-solid"} ${icon}`} />
      </span>
      <span>{t(label)}</span>
      {badge ? <Badge variant={badge.variant} className={trailingClass}>{badge.label}</Badge> : null}
      {kbd ? <kbd className={`${trailingClass} rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-600 dark:bg-slate-700`}>{kbd}</kbd> : null}
      {aiBadge ? (
        <span className={`${trailingClass} rounded bg-gradient-to-r from-indigo-500 to-sky-400 px-1.5 py-0.5 text-[9px] font-bold text-white`}>
          AI
        </span>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <button type="button" className={className} disabled>
        {content}
      </button>
    );
  }

  return (
    <NavLink
      to={href}
      onClick={onClick}
      className={({ isActive }) => `${className} ${isActive ? "bg-sky-100 font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" : ""}`}
    >
      {content}
    </NavLink>
  );
};

export default NavItem;
