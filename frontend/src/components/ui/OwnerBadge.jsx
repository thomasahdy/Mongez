import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const OwnerBadge = () => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 ${isRTL ? "mr-2" : "ml-2"}`}>
      <i className="fa-solid fa-crown text-[10px]" aria-hidden="true" />
      {t("Owner")}
    </span>
  );
};

export default OwnerBadge;
