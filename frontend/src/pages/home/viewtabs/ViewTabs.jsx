import { NavLink, useLocation, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../AppContext";

function ViewTabs() {
  const { boardId: routeBoardId } = useParams();
  const location = useLocation();
  const { activeBoard } = useAppContext();
  const { t } = useTranslation();
  const boardId = routeBoardId || activeBoard?.id;

  const tabs = [
    { to: boardId ? `/board/${boardId}/kanban` : "", icon: "fa-table-columns", label: t("viewTabs.board") },
    { icon: "fa-list", label: t("viewTabs.list") },
    { to: "/calendar", icon: "fa-calendar", label: t("viewTabs.calendar"), match: "/calendar", regular: true },
    { to: boardId ? `/board/${boardId}/timeline` : "", icon: "fa-bars-staggered", label: t("viewTabs.gantt"), match: "/timeline" },
    { to: boardId ? `/board/${boardId}/table` : "", icon: "fa-table-cells", label: t("viewTabs.table"), match: "/table" },
  ];

  return (
    <div className="view-tabs">
      <div className="view-tabs-container" role="tablist" aria-label={t("viewTabs.aria")}>
        {tabs.map(({ to, icon, label, match, regular }) => {
          const iconPrefix = regular ? "fa-regular" : "fa-solid";
          const active = Boolean(match && location.pathname.includes(match));

          if (!to) {
            return (
              <button key={label} type="button" className="view-tab" aria-disabled="true" disabled>
                <i className={`${iconPrefix} ${icon}`} />
                <span>{label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) => `view-tab ${isActive || active ? "active" : ""}`}
            >
              <i className={`${iconPrefix} ${icon}`} />
              <span>{label}</span>
            </NavLink>
          );
        })}
        <button type="button" className="view-add-btn" aria-label={t("viewTabs.addView")}>
          <i className="fa-solid fa-plus" />
          <span>{t("viewTabs.addViewLabel")}</span>
        </button>
      </div>
    </div>
  );
}

export default ViewTabs;
