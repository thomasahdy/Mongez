import { NavLink, useLocation, useParams } from "react-router";
import { useAppContext } from "../../AppContext";

function ViewTabs() {
  const { boardId: routeBoardId } = useParams();
  const location = useLocation();
  const { activeBoard } = useAppContext();
  const boardId = routeBoardId || activeBoard?.id;

  const tabs = [
    { icon: "fa-table-columns", label: "Board" },
    { icon: "fa-list", label: "List" },
    { icon: "fa-calendar", label: "Calendar", regular: true },
    { to: boardId ? `/board/${boardId}/timeline` : "", icon: "fa-bars-staggered", label: "Gantt", match: "/timeline" },
    { to: boardId ? `/board/${boardId}/table` : "", icon: "fa-table-cells", label: "Table", match: "/table" },
  ];

  return (
    <div className="view-tabs">
      <div className="view-tabs-container" role="tablist" aria-label="Workspace views">
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
        <button type="button" className="view-add-btn" aria-label="Add view">
          <i className="fa-solid fa-plus" />
          <span>View</span>
        </button>
      </div>
    </div>
  );
}

export default ViewTabs;
