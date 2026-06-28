import { useTranslation } from "react-i18next";
import mongezWordmark from "../../../assets/Mongez.svg";
import mongezMark from "../../../assets/MongezMLogo.svg";

const AuthLogo = ({ className = "mb-10" }) => {
  const { t } = useTranslation();

  return (
    <div className={`mb-8 flex justify-center ${className}`}>
      <a href="/" className="flex items-center gap-1 text-slate-900" aria-label={t("authUi.logoHome")}>
        <div className="grid h-10 w-10 place-items-center rounded-xl">
          <img src={mongezMark} alt="Mongez mark" className="h-11 w-11 object-contain" />
        </div>
        <img src={mongezWordmark} alt="Mongez" className="h-13 w-auto object-contain" />
      </a>
    </div>
  );
};

export default AuthLogo;
