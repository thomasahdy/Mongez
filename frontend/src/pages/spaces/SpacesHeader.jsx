import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";

const SpacesHeader = ({ onNewSpace }) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="mb-1.5 text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          {t("spacesPage.headerTitle")}
        </h1>
        <p className="text-[14px] text-slate-500 dark:text-slate-400">
          {t("spacesPage.headerDescription")}
        </p>
      </div>
      <Button variant="primary" size="lg" onClick={onNewSpace} aria-label={t("spacesPage.createNewSpaceAria")}>
        <i className="fa-solid fa-plus" /> {t("spacesPage.newSpace")}
      </Button>
    </div>
  );
};

export default SpacesHeader;
