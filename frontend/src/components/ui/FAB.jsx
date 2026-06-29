import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../pages/AppContext";
import { useBoard } from "../../hooks/api/useBoards";
import { useCreateTask } from "../../hooks/api/useTasks";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import CreateTaskModal from "../../pages/kanbanboard/CreateTaskModal";
import { showToastBridge } from "../../context/ToastContext";

function FAB() {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prefilled, setPrefilled] = useState(null);
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  const { activeSpace, activeBoard, activeBoards } = useAppContext();
  const selectedBoardId = activeBoard?.id || activeBoards?.[0]?.id;
  const { data: boardData } = useBoard(selectedBoardId);
  const columns = boardData?.columns || [];
  const firstColumnId = columns[0]?.id || "";
  const createTask = useCreateTask();

  const templates = useMemo(
    () => ({
      task: {},
      meeting: t("fab.templates.meeting", { returnObjects: true }),
      donorReportQ4: t("fab.templates.donorReportQ4", { returnObjects: true }),
      ministrySubmission: t("fab.templates.ministrySubmission", { returnObjects: true }),
      fundingRequest: t("fab.templates.fundingRequest", { returnObjects: true }),
      procurement: t("fab.templates.procurement", { returnObjects: true }),
      staffEvaluation: t("fab.templates.staffEvaluation", { returnObjects: true }),
    }),
    [t],
  );

  const items = useMemo(
    () => [
      { section: t("fab.sections.quickCreate") },
      { icon: "fa-regular fa-square-check", key: "task", label: t("fab.items.task"), kbd: "T" },
      { icon: "fa-regular fa-calendar", key: "meeting", label: t("fab.items.meeting"), kbd: "M" },
      { section: t("fab.sections.ngoTemplates") },
      { icon: "fa-chart-pie", key: "donorReportQ4", label: t("fab.items.donorReportQ4") },
      { icon: "fa-landmark", key: "ministrySubmission", label: t("fab.items.ministrySubmission") },
      { icon: "fa-money-bill-wave", key: "fundingRequest", label: t("fab.items.fundingRequest") },
      { icon: "fa-file-invoice", key: "procurement", label: t("fab.items.procurement") },
      { icon: "fa-user-pen", key: "staffEvaluation", label: t("fab.items.staffEvaluation") },
      { section: t("fab.sections.recent") },
      { icon: "fa-clock-rotate-left", key: "donorReportOct15", label: t("fab.items.donorReportOct15"), dim: true },
    ],
    [t],
  );

  const handleItemClick = (itemKey) => {
    if (itemKey === "donorReportOct15") {
      return;
    }

    if (!selectedBoardId || !firstColumnId) {
      showToastBridge(t("fab.missingBoard"), "warning");
      return;
    }

    const template = templates[itemKey] || {};
    setPrefilled(template);
    setShowModal(true);
    setOpen(false);
  };

  const handleTaskSubmit = async (taskData) => {
    createTask.mutate({
      board: { id: selectedBoardId },
      taskData: {
        ...taskData,
        columnId: firstColumnId,
      },
    });
    setShowModal(false);
  };

  return (
    <div className={`fixed bottom-6 z-50 ${isRTL ? "left-6" : "right-6"}`} dir={isRTL ? "rtl" : "ltr"}>
      {open && (
        <div
          className={`absolute bottom-full mb-2 w-60 bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden ${isRTL ? "left-0" : "right-0"}`}
          role="menu"
        >
          {items.map((item, index) =>
            item.section ? (
              <div key={`${item.section}-${index}`} className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-700/50">
                {item.section}
              </div>
            ) : (
              <button
                key={item.key}
                role="menuitem"
                onClick={() => handleItemClick(item.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-slate-700 dark:text-slate-205 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-none cursor-pointer ${item.dim ? "opacity-60 cursor-not-allowed" : ""} ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
              >
                <span className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <i className={`fa-solid ${item.icon}`} />
                  {item.label}
                </span>
                {item.kbd ? (
                  <kbd className="text-[10px] border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-405">
                    {item.kbd}
                  </kbd>
                ) : null}
              </button>
            ),
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        data-tour="quick-actions"
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${isRTL ? "flex-row-reverse" : ""}`}
        aria-label={t("fab.buttonAria")}
        aria-expanded={open}
      >
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-plus"} text-[14px] transition-transform duration-155`} />
        <span className="text-[13px] font-medium">{t("fab.create")}</span>
        <span className="text-[10px] opacity-50 bg-white/15 px-1.5 py-0.5 rounded">{t("fab.space")}</span>
      </button>

      {showModal ? (
        <CreateTaskModal
          boardId={selectedBoardId}
          columnId={firstColumnId}
          spaceId={activeSpace?.id || ""}
          spacePrefix={activeSpace?.prefix || activeSpace?.code || ""}
          defaultValues={prefilled}
          onSubmit={handleTaskSubmit}
          onClose={() => setShowModal(false)}
        />
      ) : null}
    </div>
  );
}

export default FAB;
