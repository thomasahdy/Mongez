import React, { useState } from 'react';
import { useAppContext } from '../../pages/AppContext';
import { useBoard } from '../../hooks/api/useBoards';
import { useCreateTask } from '../../hooks/api/useTasks';
import CreateTaskModal from '../../pages/kanbanboard/CreateTaskModal';
import { showToastBridge } from '../../context/ToastContext';

const TEMPLATES = {
  "Task": {},
  "Meeting": {
    title: "Project Alignment Meeting",
    type: "Task",
    description: "Scheduled team alignment meeting to sync on tasks and milestones."
  },
  "Donor Report (Q4)": {
    title: "Prepare Q4 Donor Report",
    priority: "HIGH",
    description: "Review and compile all NGO project reports for Q4 donor presentation."
  },
  "Ministry Submission": {
    title: "Ministry Submission Documentation",
    priority: "HIGH",
    description: "Submit updated NGO compliance paperwork to Ministry of Social Solidarity."
  },
  "Funding Request": {
    title: "Funding Request Proposal",
    priority: "MEDIUM",
    description: "Draft grant funding request for upcoming community development projects."
  },
  "Procurement (3 quotes)": {
    title: "Procurement (Collect 3 Quotes)",
    priority: "MEDIUM",
    description: "Acquire three competing quotations for office and training supply purchases."
  },
  "Staff Evaluation": {
    title: "Annual Staff Evaluation & Performance Reviews",
    priority: "LOW",
    description: "Conduct staff review interviews and document performance goals."
  }
};

const FAB_ITEMS = [
  { section: "Quick Create" },
  { icon: "fa-regular fa-square-check", label: "Task",      kbd: "T" },
  { icon: "fa-regular fa-calendar",     label: "Meeting",   kbd: "M" },
  { section: "Egyptian NGO Templates" },
  { icon: "fa-chart-pie",        label: "Donor Report (Q4)" },
  { icon: "fa-landmark",         label: "Ministry Submission" },
  { icon: "fa-money-bill-wave",  label: "Funding Request" },
  { icon: "fa-file-invoice",     label: "Procurement (3 quotes)" },
  { icon: "fa-user-pen",         label: "Staff Evaluation" },
  { section: "Recent" },
  { icon: "fa-clock-rotate-left", label: "Donor Report (Oct 15)", dim: true },
];

function FAB() {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prefilled, setPrefilled] = useState(null);

  const { activeSpace, activeBoard, activeBoards } = useAppContext();
  const selectedBoardId = activeBoard?.id || activeBoards?.[0]?.id;
  
  const { data: boardData } = useBoard(selectedBoardId);
  const columns = boardData?.columns || [];
  const firstColumnId = columns[0]?.id || "";

  const createTask = useCreateTask();

  const handleItemClick = (label) => {
    if (label.startsWith("Donor Report (Oct 15)")) return; // Recent items do nothing
    
    if (!selectedBoardId || !firstColumnId) {
      showToastBridge("Please create a board and columns in this space to use Quick Create.", "warning");
      return;
    }

    const template = TEMPLATES[label] || {};
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
      }
    });
    setShowModal(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu */}
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-60 bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
          role="menu"
        >
          {FAB_ITEMS.map((item, i) =>
            item.section ? (
              <div key={i} className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-700/50">
                {item.section}
              </div>
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={() => handleItemClick(item.label)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-slate-700 dark:text-slate-205 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-none cursor-pointer ${item.dim ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <i className={`fa-solid ${item.icon}`} />
                  {item.label}
                </span>
                {item.kbd && <kbd className="text-[10px] border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-405">{item.kbd}</kbd>}
              </button>
            )
          )}
        </div>
      )}

      {/* Pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        aria-label="Create new item"
        aria-expanded={open}
      >
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-plus"} text-[14px] transition-transform duration-155`} />
        <span className="text-[13px] font-medium">Create</span>
        <span className="text-[10px] opacity-50 bg-white/15 px-1.5 py-0.5 rounded">Space</span>
      </button>

      {showModal && (
        <CreateTaskModal
          boardId={selectedBoardId}
          columnId={firstColumnId}
          spaceId={activeSpace?.id || ""}
          spacePrefix={activeSpace?.prefix || activeSpace?.code || ""}
          defaultValues={prefilled}
          onSubmit={handleTaskSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default FAB;
