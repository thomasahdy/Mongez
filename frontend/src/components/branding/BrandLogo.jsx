import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import mongezWordmark from "../../assets/Mongez.svg";
import mongezMark from "../../assets/MongezMLogo.svg";

const BrandLogo = ({
  to = "/",
  ariaLabelKey = "authUi.logoHome",
  className = "",
  markWrapperClassName = "flex h-10 w-10 items-center justify-center rounded-xl",
  markClassName = "h-10 w-10 object-contain",
  wordmarkClassName = "h-10 w-auto object-contain",
}) => {
  const { t } = useTranslation();

  return (
    <NavLink
      to={to}
      className={`flex items-center gap-0 text-slate-900 ${className}`.trim()}
      aria-label={t(ariaLabelKey)}
    >
      <span className={markWrapperClassName}>
        <img src={mongezMark} alt={t("landing.nav.markAlt")} className={markClassName} />
      </span>
      <img src={mongezWordmark} alt={t("landing.nav.wordmarkAlt")} className={wordmarkClassName} />
    </NavLink>
  );
};

export default BrandLogo;
