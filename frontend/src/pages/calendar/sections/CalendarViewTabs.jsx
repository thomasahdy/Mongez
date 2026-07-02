import { Link } from "react-router";

export default function CalendarViewTabs({ isRTL, viewTabs }) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-5">
      <div className={`flex items-center gap-0 overflow-x-auto ${isRTL ? "flex-row-reverse" : ""}`}>
        {viewTabs.map((tab) => {
          const iconClassName = tab.icon.includes(" ") ? tab.icon : `fa-solid ${tab.icon} `;
          const content = (
            <>
              <i className={iconClassName} />
              <span>{tab.label}</span>
            </>
          );

          if (tab.to) {
            return (
              <Link
                key={tab.label}
                to={tab.to}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                  tab.active ? "border-sky-500 text-sky-600" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={tab.label}
              type="button"
              disabled
              className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-medium text-slate-300"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
