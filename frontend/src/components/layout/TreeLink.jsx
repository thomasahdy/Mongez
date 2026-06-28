import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const TreeLink = ({ label, active, badge, hasAI, dotColor, to = "/spaces", onClick }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `relative mb-0.5 flex items-center rounded-lg px-2 py-1 text-[13px] transition-all duration-150
        ${
          active
            ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        }
        ${isActive ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300" : ""}`}
    >
      {dotColor ? (
        <i className={`fa-solid fa-circle ${isRTL ? "ml-2" : "mr-2"}`} style={{ fontSize: 5, color: dotColor }} />
      ) : (
        <i className={`fa-regular fa-folder text-[11px] text-slate-400 ${isRTL ? "ml-2" : "mr-2"}`} />
      )}
      {label}
      {badge ? (
        <span className={`flex items-center gap-1 text-[10px] text-slate-400 ${isRTL ? "mr-auto" : "ml-auto"}`}>
          {badge}
          {hasAI ? <i className="fa-solid fa-bolt text-[10px] text-sky-400" title={t("spaceSwitcher.aiInsight")} /> : null}
        </span>
      ) : null}
    </NavLink>
  );
};

export default TreeLink;
