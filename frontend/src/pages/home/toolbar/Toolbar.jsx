import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";

function Toolbar() {
  const { activeBoard } = useAppContext();
  const { t } = useTranslation();

  const boardName = useMemo(() => activeBoard?.name || t("toolbar.boardTools"), [activeBoard?.name, t]);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t("toolbar.context")}</div>
          <div className="text-sm font-semibold text-slate-800">{boardName}</div>
        </div>

        
      </div>
    </div>
  );
}

export default Toolbar;
