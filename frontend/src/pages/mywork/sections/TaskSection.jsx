import { useState } from "react";
import { useTranslation } from "react-i18next";
import TaskRow from "../../../components/mywork/TaskRow";
import useLocaleDirection from "../../../hooks/useLocaleDirection";

const SECTION_CONFIG = {
  overdue: {
    icon: "fa-fire",
    labelKey: "myWorkPage.overdue",
    iconColor: "text-red-500",
    countBg: "bg-red-100 dark:bg-red-900/30 text-red-500",
    borderColor: "red",
  },
  today: {
    icon: "fa-clock",
    labelKey: "myWorkPage.dueToday",
    iconColor: "text-amber-500",
    countBg: "bg-amber-100 dark:bg-amber-900/30 text-amber-500",
    borderColor: "amber",
  },
  upcoming: {
    icon: "fa-calendar-day",
    labelKey: "myWorkPage.upcoming",
    iconColor: "text-sky-500",
    countBg: "bg-slate-100 dark:bg-slate-700 text-slate-500",
    borderColor: "",
  },
  noDueDate: {
    icon: "fa-inbox",
    labelKey: "myWorkPage.noDueDate",
    iconColor: "text-slate-400 dark:text-slate-500",
    countBg: "bg-slate-100 dark:bg-slate-700 text-slate-500",
    borderColor: "",
  },
};

const TaskSection = ({ sectionKey, tasks, completedIds, onComplete }) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const [open, setOpen] = useState(true);
  const cfg = SECTION_CONFIG[sectionKey];
  const label = t(cfg.labelKey);
  const activeTasks = tasks.filter((task) => !completedIds.has(task.id));
  const leftBorder = cfg.borderColor
    ? `${isRtl ? `border-r-${cfg.borderColor}-500` : `border-l-${cfg.borderColor}-500`}`
    : "";

  const dueColors = {
    overdue: "text-red-500",
    today: "text-amber-500",
    upcoming: "text-slate-400 dark:text-slate-500",
    noDueDate: "text-slate-400 dark:text-slate-500",
  };

  return (
    <section aria-label={label} dir={dir}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={`w-full flex items-center gap-2 py-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg ${
          isRtl ? "text-right" : "text-left"
        }`}
        aria-expanded={open}
      >
        <i className={`fa-solid ${cfg.icon} ${cfg.iconColor} text-[13px]`} aria-hidden="true" />
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.countBg}`}>{activeTasks.length}</span>
        <i
          className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${
            isRtl ? "mr-auto" : "ml-auto"
          } ${open ? "" : isRtl ? "rotate-90" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </button>

      <div className={`flex flex-col gap-1.5 transition-all duration-300 ${open ? "block" : "hidden"}`} role="list">
        {activeTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            leftBorder={leftBorder}
            dueColor={dueColors[sectionKey]}
            completed={completedIds.has(task.id)}
            onComplete={onComplete}
          />
        ))}

        {activeTasks.length === 0 && tasks.length > 0 && (
          <p className="text-center text-[12px] text-slate-400 py-3">{t("myWorkPage.allDone")}</p>
        )}
      </div>
    </section>
  );
};

export default TaskSection;
